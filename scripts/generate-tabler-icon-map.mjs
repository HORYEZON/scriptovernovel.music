#!/usr/bin/env node
// scripts/generate-tabler-icon-map.mjs
//
// Regenerates lib/tabler-icon-imports.generated.ts from the currently
// installed @tabler/icons-react package. Run this after bumping that
// dependency's version:
//
//   node scripts/generate-tabler-icon-map.mjs
//
// Why this exists: @tabler/icons-react ships dist/esm/dynamic-imports.mjs
// with per-icon import() calls, but they point at .ts source files that
// aren't included in the published package (only the compiled .mjs files
// are). The *names* in that file are accurate — only the extension is
// wrong — so we scrape the kebab-case-name -> PascalCase-filename pairs out
// of it and re-emit our own map of explicit, individually-written import()
// calls pointing at the real .mjs files (deliberately NOT a single dynamic
// `import(`.../${file}.mjs`)` template-literal call — webpack turns that
// into one big "context module" covering all ~6,200 icons, which bloats
// the shared runtime chunk on every page by ~140kB even though the icon
// *code* stays lazy. Explicit per-icon import() calls, mirroring how
// lucide-react's own dynamicIconImports.js is written, don't have that
// cost — but even that costs real bytes per registered chunk (~13
// bytes/icon in the shared runtime manifest, paid on every public page
// regardless of whether Tabler is used). So the full ~6,200-icon catalog is
// deliberately curated down to ~1,500 here (dropping "-off"/"-filled"
// variants, then a fixed stride sample) — matching Lucide's own catalog
// size and cost. See components/ui/DynamicIcon.tsx for how the map is used.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const srcPath = join(
  root,
  "node_modules/@tabler/icons-react/dist/esm/dynamic-imports.mjs"
);
const outPath = join(root, "lib/tabler-icon-imports.generated.ts");

const src = readFileSync(srcPath, "utf8");
const re = /"([a-z0-9-]+)":\s*\(\)\s*=>\s*import\('\.\/icons\/(Icon[A-Za-z0-9]+)\.ts'\)/g;

const allPairs = [];
let match;
while ((match = re.exec(src))) {
  allPairs.push([match[1], match[2]]);
}

if (allPairs.length === 0) {
  console.error(
    "No icon entries matched — @tabler/icons-react's dynamic-imports.mjs " +
      "format may have changed. Update the regex in this script."
  );
  process.exit(1);
}

// Icon names IconPicker.tsx's SUGGESTED grid always shows for the Tabler
// tab — guaranteed a spot below regardless of where the stride sample would
// otherwise land, so the "suggested" grid never has holes in it. Keep this
// in sync with the `tabler:` array in IconPicker.tsx's SUGGESTED constant.
const ALWAYS_INCLUDE = new Set([
  "robot", "ghost", "sparkles", "cat", "dog", "fish", "bug", "feather",
  "paw", "egg", "leaf", "flame", "star", "mood-smile", "heart", "diamond",
  "crown", "wand", "puzzle", "rocket", "shape", "palette", "user-circle",
  "confetti", "masks-theater",
]);

// Drop "-off" (negated) and "-filled" (solid) variants — keep one clean
// outline icon per concept — then take a fixed stride sample to land at
// ~1,500 entries, same order of magnitude as Lucide's catalog. The
// always-include set is unioned in afterward so none of it gets skipped.
const deduped = allPairs.filter(
  ([kebab]) => !kebab.endsWith("-off") && !kebab.endsWith("-filled")
);
const TARGET_COUNT = 1500;
const stride = Math.max(1, Math.floor(deduped.length / TARGET_COUNT));
const sampled = deduped.filter((_, i) => i % stride === 0);

const sampledNames = new Set(sampled.map(([kebab]) => kebab));
const forced = deduped.filter(
  ([kebab]) => ALWAYS_INCLUDE.has(kebab) && !sampledNames.has(kebab)
);
const pairs = [...sampled, ...forced];

const lines = pairs
  .map(
    ([kebab, pascal]) =>
      `  "${kebab}": () => import("@tabler/icons-react/dist/esm/icons/${pascal}.mjs"),`
  )
  .join("\n");

const output = `// lib/tabler-icon-imports.generated.ts
// AUTO-GENERATED — do not hand-edit.
//
// One explicit import() per Tabler icon (mirrors the shape of
// lucide-react's own dynamicIconImports.js). See
// scripts/generate-tabler-icon-map.mjs for why this is generated this way
// instead of importing @tabler/icons-react/dist/esm/dynamic-imports.mjs
// directly, and components/ui/DynamicIcon.tsx for how it's consumed.
//
// Regenerate after bumping @tabler/icons-react:
//   node scripts/generate-tabler-icon-map.mjs
import type { ComponentType, SVGProps } from "react";

type TablerIconImport = () => Promise<{
  default: ComponentType<SVGProps<SVGSVGElement> & { size?: string | number }>;
}>;

export const tablerDynamicImports: Record<string, TablerIconImport> = {
${lines}
};

export default tablerDynamicImports;
`;

writeFileSync(outPath, output);
console.log(`Wrote ${pairs.length} icon entries to ${outPath}`);
