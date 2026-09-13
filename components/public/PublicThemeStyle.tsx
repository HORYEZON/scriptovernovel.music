// components/public/PublicThemeStyle.tsx
//
// Injects the admin-configured public theme as :root CSS custom properties.
// Rendered only inside app/(public)/layout.tsx, so it exists in the DOM
// exactly while a public route is mounted — navigating into /admin unmounts
// this layout (and this tag with it), which lets the app/globals.css
// defaults take back over automatically. No client JS needed.
//
// Values are re-validated here (in addition to app/api/theme's own
// validation) since they're interpolated into a raw <style> tag — this is
// a defense-in-depth check against a theme row edited directly in the DB.
import { resolveSiteTheme, buildWashDeclarations, type SiteThemeSettings } from "@/lib/theme";

// Single-value, mode-independent fields — cursorGlowColors is an array and
// gets its own handling below (one --cursor-glow-N var per slot),
// cursorGlowEnabled isn't a CSS value at all (it's passed as a prop to
// CursorGlow in the layout), and the wash/scope fields are handled by
// buildWashDeclarations below instead of through this flat map (scope isn't
// a CSS value at all, and the colors/brightness are mode-conditional).
// Admin-only surface colors (see lib/theme.ts) are handled by
// AdminThemeStyle, not here — this component only ever mounts inside
// app/(public)/layout.tsx.
type SingleValueField = Exclude<
  keyof SiteThemeSettings,
  | "cursorGlowEnabled"
  | "cursorGlowColors"
  | "darkWashColor"
  | "darkBrightness"
  | "lightWashColor"
  | "lightBrightness"
  | "darkWashScope"
  | "lightWashScope"
  | "bgBlur"
  | "adminBgBlur"
  | "adminCardBgLight"
  | "adminCardBgDark"
  | "adminModalBgLight"
  | "adminModalBgDark"
  | "adminInputBgLight"
  | "adminInputBgDark"
>;

const CSS_VAR_MAP: Record<SingleValueField, string> = {
  btnPrimaryColor: "--theme-btn-primary",
  btnSecondaryColor: "--theme-btn-secondary",
  btnHoverColor: "--theme-btn-primary-hover",
  scrollbarTrackColor: "--theme-scrollbar-track",
  scrollbarThumbColor: "--theme-scrollbar-thumb",
  fontFamily: "--theme-font-family",
  fontSizeBase: "--theme-font-size-base",
  fontSizeHeading: "--theme-font-size-heading",
  fontSizeBody: "--theme-font-size-body",
};

export function PublicThemeStyle({
  theme,
}: {
  theme: Partial<Record<keyof SiteThemeSettings, unknown>> | null | undefined;
}) {
  const resolved = resolveSiteTheme(theme);
  const declarations = (Object.keys(CSS_VAR_MAP) as SingleValueField[])
    .map((field) => `${CSS_VAR_MAP[field]}:${resolved[field]};`)
    .join("");
  const cursorGlowVars = resolved.cursorGlowColors
    .map((color, i) => `--cursor-glow-${i + 1}:${color};`)
    .join("");

  // Holds the *entire* backdrop-filter expression, not just the px number —
  // see globals.css's .page-glass comment for why (a var() nested inside
  // blur() gets silently dropped by Turbopack's dev CSS pass).
  const bgBlurDeclaration = `--theme-bg-blur:blur(${resolved.bgBlur}) saturate(120%);`;

  // Wash tint (.page-glass in globals.css) + background-photo brightness are
  // mode-conditional, not single flat values — :root covers light mode,
  // .dark overrides it for dark, matching how ThemeToggle flips the "dark"
  // class on <html>. Declared in that order so .dark wins the cascade tie
  // (equal specificity, later rule wins) exactly when the class is present.
  // Either can come back empty if that mode's scope is set to "admin" only
  // (see AdminThemeStyle) — buildWashDeclarations is the single place that
  // logic lives, shared between the two components.
  const { root: lightWashVars, dark: darkWashVars } = buildWashDeclarations(resolved, "public");

  return (
    <style
      id="public-theme-vars"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `:root{${declarations}${bgBlurDeclaration}${cursorGlowVars}${lightWashVars}}${darkWashVars ? `.dark{${darkWashVars}}` : ""}`,
      }}
    />
  );
}
