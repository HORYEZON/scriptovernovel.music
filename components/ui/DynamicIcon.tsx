// components/ui/DynamicIcon.tsx
// Renders an icon by name from one of several icon "platforms" (Lucide,
// Tabler, ...), lazily — only the picked icon's chunk is ever downloaded.
// Backs the icon-gallery pickers in Settings → Preferences (see
// IconPicker.tsx). Pulls in the full Lucide + Tabler icon-import maps
// (~3,000 entries combined), so callers that only need to check/parse a
// stored icon value — not render one — should import from icon-values.ts
// instead, and dynamic-import this module (see AdminSidebar.tsx,
// FaqChatbox.tsx for the pattern) so those maps aren't part of their
// always-mounted module graph.
"use client";

import { lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode, type SVGProps } from "react";
import lucideDynamicImports from "lucide-react/dynamicIconImports";
import tablerDynamicImports from "@/lib/tabler-icon-imports.generated";
import type { IconPlatform } from "./icon-values";

export { type IconPlatform, ICON_PLATFORMS, isIconName, parseIconValue, toIconValue } from "./icon-values";

// Every icon across both platforms resolves to a distinct forwardRef
// component type that TS can't unify into one precise signature here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconComponent = ComponentType<any>;
type IconImporter = () => Promise<{ default: IconComponent }>;
type IconImportMap = Record<string, IconImporter>;

const PLATFORM_IMPORTS: Record<IconPlatform, IconImportMap> = {
  lucide: lucideDynamicImports,
  tabler: tablerDynamicImports,
};

// All valid icon names for a platform — used by IconPicker's search/browse
// grid. No icon code is loaded until a name is actually rendered.
export function getIconNames(platform: IconPlatform): string[] {
  return Object.keys(PLATFORM_IMPORTS[platform]);
}

// Module-level cache so repeated renders of the same icon (e.g. re-opening
// the picker) reuse the same lazy component instead of re-triggering
// React.lazy's identity churn.
const lazyCache = new Map<string, LazyExoticComponent<IconComponent>>();

export interface DynamicIconProps extends SVGProps<SVGSVGElement> {
  platform: IconPlatform;
  name: string;
  size?: string | number;
  fallback?: ReactNode;
}

export function DynamicIcon({ platform, name, fallback = null, size = 24, ...rest }: DynamicIconProps) {
  const importFn = PLATFORM_IMPORTS[platform]?.[name];
  if (!importFn) return <>{fallback}</>;

  const cacheKey = `${platform}:${name}`;
  let Icon = lazyCache.get(cacheKey);
  if (!Icon) {
    Icon = lazy(importFn);
    lazyCache.set(cacheKey, Icon);
  }

  return (
    <Suspense fallback={fallback}>
      <Icon size={size} {...rest} />
    </Suspense>
  );
}
