// types/tabler-icons-react.d.ts
// @tabler/icons-react's compiled per-icon files (dist/esm/icons/*.mjs) ship
// without their own .d.ts, and the package has no `exports` map, so a deep
// import needs an ambient wildcard declaration. Backs the generated static
// import map in lib/tabler-icon-imports.generated.ts (see
// scripts/generate-tabler-icon-map.mjs and components/ui/DynamicIcon.tsx).
declare module "@tabler/icons-react/dist/esm/icons/*.mjs" {
  import type { ComponentType, SVGProps } from "react";

  const TablerIcon: ComponentType<SVGProps<SVGSVGElement> & { size?: string | number }>;
  export default TablerIcon;
}
