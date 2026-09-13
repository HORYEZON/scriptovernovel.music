// scripts/security-check.ts
//
// Runnable version of the verification playbook in Docs/System_Security.md.
//
//   yarn security:check
//
// Run it after any Supabase dashboard change, any `yarn db:push`, and before a
// release. It talks to the REAL project in .env — by default that is
// production, which is the point: these are the doors the internet can knock
// on, and only the live project can answer for them.
//
// Everything here is read-only except check 4, which attempts an upload that
// is SUPPOSED to fail. If that upload ever succeeds the script deletes the
// file it just created (with the service role) and reports a CRITICAL — a
// failure there means anyone on the internet can write to the bucket, which
// is exactly the flaw the 2026-09-05 audit found and closed.
//
// Exit code is 0 only when every critical check passes, so this is safe to
// wire into CI later.
import "dotenv/config";
import { Client } from "pg";

// ── tiny reporter ────────────────────────────────────────────────────────────

type Level = "critical" | "warn";

let failures = 0;
let warnings = 0;

function pass(label: string, detail = "") {
  console.log(`  \x1b[32m✅\x1b[0m ${label}${detail ? `  \x1b[2m${detail}\x1b[0m` : ""}`);
}

function fail(label: string, detail: string, level: Level = "critical") {
  if (level === "critical") {
    failures++;
    console.log(`  \x1b[31m❌ ${label}\x1b[0m  ${detail}`);
  } else {
    warnings++;
    console.log(`  \x1b[33m⚠️  ${label}\x1b[0m  ${detail}`);
  }
}

function section(title: string) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

/** Assert a condition, reporting either way. */
function check(ok: boolean, label: string, detail: string, level: Level = "critical") {
  if (ok) pass(label, detail);
  else fail(label, detail, level);
}

// ── env ──────────────────────────────────────────────────────────────────────

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PG = process.env.DIRECT_URL || process.env.DATABASE_URL;

const BUCKET = "scriptovernovel.music-artworks";

/**
 * Tables worth naming individually rather than looping the whole schema: if
 * any ONE of these ever answers something other than 401, the finding is
 * already severe enough to stop and read.
 */
const SENSITIVE_TABLES = [
  "User",
  "Session",
  "Account",
  "Order",
  "OrderItem",
  "PasswordResetToken",
  "VerificationToken",
];

async function main() {
  console.log("\n\x1b[1mscriptovernovel.music — security check\x1b[0m");
  console.log(`\x1b[2mtarget: ${URL_ ?? "(NEXT_PUBLIC_SUPABASE_URL unset)"}\x1b[0m`);

  if (!URL_ || !ANON) {
    console.error(
      "\n\x1b[31mNEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.\x1b[0m\n"
    );
    process.exit(2);
  }

  const anonHeaders = { apikey: ANON, Authorization: `Bearer ${ANON}` };

  // ── 1. The public API role must not reach the database ─────────────────────
  //
  // The anon key ships in the JS bundle, so this is what any visitor can try
  // from their browser console. Expect 401 "permission denied for schema
  // public" on every table — refused at the schema level, before RLS is even
  // consulted.
  section("1. Database — PostgREST must refuse the anon key");

  for (const table of SENSITIVE_TABLES) {
    const res = await fetch(`${URL_}/rest/v1/${table}?select=*&limit=1`, {
      headers: anonHeaders,
    });
    check(
      res.status === 401 || res.status === 404,
      `${table} refused`,
      `HTTP ${res.status}${res.status === 200 ? " — READABLE BY ANYONE" : ""}`
    );
  }

  // pg_graphql is the second auto-generated API over the same tables. If it is
  // ever enabled it becomes a whole new surface that needs its own review.
  const gql = await fetch(`${URL_}/graphql/v1`, {
    method: "POST",
    headers: { ...anonHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ query: "{ __schema { queryType { name } } }" }),
  });
  const gqlBody = await gql.text();
  check(
    gqlBody.includes("not enabled") || gql.status === 401,
    "GraphQL API not exposed",
    gqlBody.includes("not enabled") ? "pg_graphql disabled" : `HTTP ${gql.status}`
  );

  // ── 2. Storage must not accept anonymous writes ────────────────────────────
  section("2. Storage — anonymous upload must be refused");

  // text/html is the interesting one: it is excluded from the bucket's MIME
  // allowlist AND blocked by the absence of an anon INSERT policy, so a 200
  // here means both layers are gone.
  const probePath = `_securitycheck/${Date.now()}.html`;
  const upload = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${probePath}`, {
    method: "POST",
    headers: { ...anonHeaders, "Content-Type": "text/html" },
    body: "<html>security-check probe</html>",
  });

  if (upload.status === 200) {
    fail(
      "anonymous upload refused",
      "HTTP 200 — ANYONE ON THE INTERNET CAN WRITE TO YOUR BUCKET"
    );
    // Don't leave the probe sitting in production storage.
    if (SERVICE) {
      const del = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${probePath}`, {
        method: "DELETE",
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
      });
      console.log(
        `     \x1b[2mprobe file cleaned up: ${del.ok ? "yes" : `NO — delete ${probePath} by hand`}\x1b[0m`
      );
    } else {
      console.log(
        `     \x1b[2mSUPABASE_SERVICE_ROLE_KEY unset — delete ${probePath} by hand\x1b[0m`
      );
    }
  } else {
    pass("anonymous upload refused", `HTTP ${upload.status}`);
  }

  // Listing is a separate permission from reading a known URL. With no SELECT
  // policy on storage.objects, an anonymous list returns an empty array rather
  // than every filename in the bucket.
  const list = await fetch(`${URL_}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { ...anonHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 5 }),
  });
  const listed = list.ok ? ((await list.json()) as unknown[]) : [];
  check(
    !list.ok || listed.length === 0,
    "bucket cannot be enumerated",
    list.ok ? `${listed.length} filenames returned` : `HTTP ${list.status}`
  );

  // ── 3. …but the public site must still work ────────────────────────────────
  //
  // The failure mode of over-tightening storage is invisible until someone
  // loads the gallery, so it gets a check of its own. A public bucket serves
  // /object/public/... without consulting RLS, which is why dropping the
  // SELECT policy above does not break these.
  section("3. Public site — reads must still work");

  if (SERVICE) {
    // Ask the service role for a real object rather than hardcoding a filename
    // that might get deleted later.
    const sample = await fetch(
      `${URL_}/storage/v1/object/list/${BUCKET}`,
      {
        method: "POST",
        headers: {
          apikey: SERVICE,
          Authorization: `Bearer ${SERVICE}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefix: "", limit: 1, sortBy: { column: "name", order: "asc" } }),
      }
    );
    const rows = sample.ok ? ((await sample.json()) as { name: string }[]) : [];
    const name = rows[0]?.name;
    if (name) {
      const pub = await fetch(`${URL_}/storage/v1/object/public/${BUCKET}/${name}`);
      check(pub.ok, "public image URL loads", `HTTP ${pub.status} — ${name}`);
    } else {
      fail("public image URL loads", "no objects found to sample", "warn");
    }
  } else {
    fail("public image URL loads", "SUPABASE_SERVICE_ROLE_KEY unset — skipped", "warn");
  }

  // ── 4. Database invariants ─────────────────────────────────────────────────
  //
  // These are the four conditions that, together, make check 1 true. Testing
  // them directly catches a regression the moment it lands rather than when
  // someone happens to probe the API.
  section("4. Database invariants (direct connection)");

  if (!PG) {
    fail("database invariants", "DIRECT_URL/DATABASE_URL unset — skipped", "warn");
  } else {
    const client = new Client({
      connectionString: PG,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    try {
      const noRls = await client.query<{ relname: string }>(`
        select c.relname from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
      check(
        noRls.rowCount === 0,
        "every table has RLS enabled",
        noRls.rowCount === 0
          ? "0 tables without RLS"
          : `WITHOUT RLS: ${noRls.rows.map((r) => r.relname).join(", ")}`
      );

      // Deny-all is the intended state. A policy here is not automatically a
      // hole — with grants revoked it is inert — but it is a landmine: one
      // GRANT away from becoming live. See Docs/System_Security.md.
      const pol = await client.query<{ n: string }>(
        `select count(*) n from pg_policies where schemaname = 'public'`
      );
      check(
        pol.rows[0].n === "0",
        "no policies in public (deny-all)",
        `${pol.rows[0].n} found`,
        pol.rows[0].n === "0" ? "critical" : "warn"
      );

      const usage = await client.query<{ a: boolean; b: boolean }>(
        `select has_schema_privilege('anon','public','USAGE') a,
                has_schema_privilege('authenticated','public','USAGE') b`
      );
      check(
        !usage.rows[0].a && !usage.rows[0].b,
        "anon/authenticated have no schema USAGE",
        `anon=${usage.rows[0].a} authenticated=${usage.rows[0].b}`
      );

      const grants = await client.query<{ n: string }>(`
        select count(*) n from information_schema.role_table_grants
         where table_schema = 'public' and grantee in ('anon','authenticated')`);
      check(grants.rows[0].n === "0", "anon/authenticated have no table grants", `${grants.rows[0].n} grants`);

      // The safety net that keeps `yarn db:push` from shipping a table with
      // RLS off. 'O' means enabled in origin/local mode.
      const trig = await client.query<{ evtenabled: string }>(
        `select evtenabled from pg_event_trigger where evtname = 'ensure_rls'`
      );
      check(
        trig.rowCount === 1 && trig.rows[0].evtenabled !== "D",
        "ensure_rls trigger is armed",
        trig.rowCount === 0 ? "MISSING — new tables will ship without RLS" : `evtenabled=${trig.rows[0].evtenabled}`
      );

      const sp = await client.query<{ n: string }>(
        `select count(*) n from pg_policies where schemaname = 'storage' and tablename = 'objects'`
      );
      check(
        sp.rows[0].n === "0",
        "no policies on storage.objects",
        `${sp.rows[0].n} found`,
        sp.rows[0].n === "0" ? "critical" : "warn"
      );

      const bucket = await client.query<{
        public: boolean;
        file_size_limit: string | null;
        allowed_mime_types: string[] | null;
      }>(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = $1`, [
        BUCKET,
      ]);
      const b = bucket.rows[0];
      if (!b) {
        fail("bucket is hardened", `bucket ${BUCKET} not found`);
      } else {
        check(b.file_size_limit !== null, "bucket has a size cap", `${b.file_size_limit ?? "none"} bytes`);
        const mimes = b.allowed_mime_types ?? [];
        check(
          mimes.length > 0 &&
            !mimes.includes("text/html") &&
            !mimes.includes("image/svg+xml"),
          "MIME allowlist excludes html/svg",
          mimes.length === 0 ? "NO ALLOWLIST SET" : `${mimes.length} types allowed`
        );
      }
    } finally {
      await client.end();
    }
  }

  // ── summary ────────────────────────────────────────────────────────────────
  console.log("");
  if (failures === 0 && warnings === 0) {
    console.log("\x1b[32m\x1b[1mAll checks passed.\x1b[0m\n");
  } else if (failures === 0) {
    console.log(`\x1b[33m\x1b[1mPassed with ${warnings} warning(s).\x1b[0m\n`);
  } else {
    console.log(
      `\x1b[31m\x1b[1m${failures} CRITICAL failure(s)${warnings ? `, ${warnings} warning(s)` : ""}.\x1b[0m`
    );
    console.log("\x1b[2mSee Docs/System_Security.md for what each check protects.\x1b[0m\n");
  }
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\n\x1b[31msecurity-check crashed:\x1b[0m", err);
  process.exit(2);
});
