// scripts/rewrite-media-urls.ts
//
// Second half of the Supabase → R2 media migration (the first is
// migrate-media-to-r2.ts, which must have copied and verified every object
// first). Rewrites every media URL in the database from the Supabase public
// prefix to the R2 one:
//
//   https://<ref>.supabase.co/storage/v1/object/public/scriptovernovel.music-artworks/
//   → https://<R2_PUBLIC_URL>/
//
// It does not know or care which columns hold URLs. It asks information_schema
// for every text, varchar, text[] and json(b) column in the public schema and
// substring-replaces the prefix wherever it appears — a bare URL, an entry in
// a String[] column, or a URL nested inside a JSON config blob (the museum's
// arcade-config / about-contact rows keep one there). Anything that treated
// "a column holding a URL" as a whole value would miss or corrupt the last
// two shapes; substring replacement is right for all three.
//
// Everything runs in one transaction. Before any UPDATE, the current value of
// every row about to change is written to rollback-media-urls-<ts>.json so
// the whole thing can be reversed.
//
// Usage:
//   npx tsx --env-file=.env scripts/rewrite-media-urls.ts            # dry run — counts only
//   npx tsx --env-file=.env scripts/rewrite-media-urls.ts --apply
import "dotenv/config";
import fs from "node:fs";
import { Pool } from "pg";

const APPLY = process.argv.includes("--apply");

const OLD_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "")}/storage/v1/object/public/scriptovernovel.music-artworks/`;
const NEW_PREFIX = `${process.env.R2_PUBLIC_URL!.replace(/\/+$/, "")}/`;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

type Col = { table: string; column: string; kind: "text" | "array" | "json"; udt: string };

async function discoverColumns(): Promise<Col[]> {
  const { rows } = await pool.query<{ table_name: string; column_name: string; data_type: string; udt_name: string }>(`
    SELECT table_name, column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name NOT LIKE '\\_prisma%'
      AND (data_type IN ('text', 'character varying', 'json', 'jsonb') OR (data_type = 'ARRAY' AND udt_name IN ('_text', '_varchar')))
    ORDER BY table_name, column_name`);
  return rows.map((r) => ({
    table: r.table_name,
    column: r.column_name,
    kind: r.data_type === "ARRAY" ? "array" : r.data_type.startsWith("json") ? "json" : "text",
    udt: r.udt_name,
  }));
}

function matchExpr(c: Col): string {
  const col = `"${c.column}"`;
  if (c.kind === "array") return `array_to_string(${col}, E'\\n')`;
  if (c.kind === "json") return `${col}::text`;
  return col;
}

function replaceExpr(c: Col): string {
  const col = `"${c.column}"`;
  if (c.kind === "array") return `ARRAY(SELECT replace(x, $1, $2) FROM unnest(${col}) AS x)`;
  // Cast back to the column's own type (json vs jsonb) so the assignment is exact.
  if (c.kind === "json") return `replace(${col}::text, $1, $2)::${c.udt}`;
  return `replace(${col}, $1, $2)`;
}

async function main() {
  console.log(`${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`  from: ${OLD_PREFIX}`);
  console.log(`  to:   ${NEW_PREFIX}\n`);

  const cols = await discoverColumns();
  const hits: { col: Col; rows: number }[] = [];
  for (const c of cols) {
    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM "${c.table}" WHERE ${matchExpr(c)} LIKE '%' || $1 || '%'`,
      [OLD_PREFIX]
    );
    const n = Number(rows[0].n);
    if (n > 0) hits.push({ col: c, rows: n });
  }

  const totalRows = hits.reduce((a, h) => a + h.rows, 0);
  console.log(`scanned ${cols.length} columns; ${hits.length} carry the Supabase prefix, ${totalRows} row-values to rewrite:`);
  for (const h of hits) console.log(`  ${String(h.rows).padStart(5)}  ${h.col.table}.${h.col.column}  (${h.col.kind})`);

  if (!APPLY) {
    console.log("\nDry run only. Pass --apply to rewrite (inside one transaction, with a rollback file).");
    await pool.end();
    return;
  }

  // Rollback capture — one entry per row-value that is about to change.
  const rollback: { table: string; column: string; id: string | null; before: unknown }[] = [];
  for (const h of hits) {
    const hasId = (await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='id'`,
      [h.col.table]
    )).rowCount! > 0;
    const { rows } = await pool.query(
      `SELECT ${hasId ? '"id"::text AS id,' : "NULL AS id,"} "${h.col.column}" AS before FROM "${h.col.table}" WHERE ${matchExpr(h.col)} LIKE '%' || $1 || '%'`,
      [OLD_PREFIX]
    );
    for (const r of rows) rollback.push({ table: h.col.table, column: h.col.column, id: r.id, before: r.before });
    if (!hasId) console.warn(`  ! ${h.col.table} has no "id" column — rollback entries for it are not row-addressable`);
  }
  const rbPath = `rollback-media-urls-${Date.now()}.json`;
  fs.writeFileSync(rbPath, JSON.stringify({ oldPrefix: OLD_PREFIX, newPrefix: NEW_PREFIX, rows: rollback }, null, 2));
  console.log(`\nrollback written: ${rbPath} (${rollback.length} row-values)`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let updated = 0;
    for (const h of hits) {
      const res = await client.query(
        `UPDATE "${h.col.table}" SET "${h.col.column}" = ${replaceExpr(h.col)} WHERE ${matchExpr(h.col)} LIKE '%' || $1 || '%'`,
        [OLD_PREFIX, NEW_PREFIX]
      );
      updated += res.rowCount ?? 0;
    }
    // Nothing may still point at Supabase once we're done.
    let leftover = 0;
    for (const c of cols) {
      const { rows } = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM "${c.table}" WHERE ${matchExpr(c)} LIKE '%' || $1 || '%'`,
        [OLD_PREFIX]
      );
      leftover += Number(rows[0].n);
    }
    if (leftover > 0) throw new Error(`${leftover} row-values still carry the old prefix after rewrite — rolling back`);
    await client.query("COMMIT");
    console.log(`applied: ${updated} rows updated across ${hits.length} columns; 0 references to Supabase remain.`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
