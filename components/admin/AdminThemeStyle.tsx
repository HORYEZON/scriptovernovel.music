// components/admin/AdminThemeStyle.tsx
//
// Admin-context counterpart to components/public/PublicThemeStyle.tsx.
// Handles the Dark/Light Mode wash vars (--theme-wash,
// --theme-bg-brightness, gated by the Public/Admin/Both scope selector),
// .admin-shell's own base color derived from that same wash (--admin-shell-
// wash, see its comment below), the admin-only surface colors
// (--admin-card-bg/-dark, --admin-modal-bg/-dark, --admin-input-bg/-dark),
// background image (--admin-bg-image) and its blur intensity
// (--admin-bg-blur) — unlike the wash vars, these last few have no scope
// selector and no public-site counterpart, so they're always emitted once
// set. Consumed by app/globals.css's
// .admin-card/.admin-modal/.admin-input/.admin-shell classes.
// Buttons/scrollbar/fonts/cursor-glow stay public-only. Mounted in
// app/(admin)/layout.tsx only — "Admin" here means the /admin/* dashboard
// specifically, not /login or /reset-password (a separate route group with
// no layout of its own to hook into).
import {
  resolveSiteTheme,
  buildWashDeclarations,
  washScopeMatches,
  type SiteThemeSettings,
} from "@/lib/theme";

// Admin-only surface fields — always-on (no scope selector) since they only
// ever apply within /admin. All mode-conditional like the wash vars
// (separate Light/Dark columns, each its own flat CSS var). adminBgBlur is
// handled separately below (needs its raw px wrapped in blur(), not a flat
// passthrough — see the comment there).
const ADMIN_SURFACE_VAR_MAP: {
  field: keyof SiteThemeSettings;
  varName: string;
}[] = [
  { field: "adminCardBgLight", varName: "--admin-card-bg" },
  { field: "adminCardBgDark", varName: "--admin-card-bg-dark" },
  { field: "adminModalBgLight", varName: "--admin-modal-bg" },
  { field: "adminModalBgDark", varName: "--admin-modal-bg-dark" },
  { field: "adminInputBgLight", varName: "--admin-input-bg" },
  { field: "adminInputBgDark", varName: "--admin-input-bg-dark" },
];

export function AdminThemeStyle({
  theme,
}: {
  // adminBackgroundImage lives on SiteTheme but outside SiteThemeSettings —
  // see lib/theme.ts's doc comment on SiteThemeSettings for why — so it's
  // typed as an explicit extra field rather than through resolveSiteTheme.
  theme:
    | (Partial<Record<keyof SiteThemeSettings, unknown>> & {
        adminBackgroundImage?: string | null;
      })
    | null
    | undefined;
}) {
  const resolved = resolveSiteTheme(theme);
  const { root: washRoot, dark: washDark } = buildWashDeclarations(resolved, "admin");

  // .admin-shell's own base background-color (Preferences → Branding →
  // "Dark Mode"/"Light Mode" background) — deliberately its own var rather
  // than reusing --theme-wash above: --theme-wash always has a real value
  // (globals.css's :root/.dark declare a base default unconditionally, for
  // .page-glass's benefit), so a var(--theme-wash, fallback) here could
  // never actually fall back — every install would get a translucent admin
  // background whether or not they'd ever touched the "Apply To" scope
  // selector. --admin-shell-wash is only ever declared when that mode's
  // scope genuinely includes "admin", so the var() fallback below in
  // globals.css works correctly for everyone who hasn't opted in.
  const adminShellWashLight = washScopeMatches(resolved.lightWashScope, "admin")
    ? `--admin-shell-wash:${resolved.lightWashColor};`
    : "";
  const adminShellWashDark = washScopeMatches(resolved.darkWashScope, "admin")
    ? `--admin-shell-wash:${resolved.darkWashColor};`
    : "";

  const surfaceDeclarations = ADMIN_SURFACE_VAR_MAP.map(
    ({ field, varName }) => `${varName}:${resolved[field]};`
  ).join("");

  // Holds the *entire* filter expression, not just the px number — see
  // globals.css's .admin-shell::before comment for why (a var() nested
  // inside blur() gets silently dropped by Turbopack's dev CSS pass).
  const bgBlurDeclaration = `--admin-bg-blur:blur(${resolved.adminBgBlur});`;

  // Interpolated into a raw <style> tag, so quotes are stripped defensively
  // rather than trusted — same reasoning as PublicThemeStyle's file-level
  // comment on re-validating values here.
  const bgImage = theme?.adminBackgroundImage?.replace(/['"]/g, "");
  const bgImageDeclaration = bgImage ? `--admin-bg-image:url('${bgImage}');` : "";

  const root = `${washRoot}${adminShellWashLight}${surfaceDeclarations}${bgImageDeclaration}${bgBlurDeclaration}`;
  const dark = `${washDark}${adminShellWashDark}`;
  if (!root && !dark) return null;

  return (
    <style
      id="admin-theme-vars"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `${root ? `:root{${root}}` : ""}${dark ? `.dark{${dark}}` : ""}`,
      }}
    />
  );
}
