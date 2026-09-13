// emails/preview-data.ts
//
// Shared fixtures for the `yarn email` (react-email dev/export) preview
// server, which renders each template's default export with no props and
// never touches the database — so templates can't fall back to
// `profile.logoImage` the way a real send does. Each template imports
// PREVIEW_LOGO_URL as its `logoUrl` default so the preview actually shows
// the uploaded Navbar Logo instead of always rendering the "no logo
// uploaded yet" wordmark fallback. Real sends are unaffected — lib/mail.ts
// always passes the live `profile.logoImage` value, this file is preview-only.
//
// Update this if the logo uploaded in Admin > Preferences > Branding changes
// and you want the local preview to match.
export const PREVIEW_LOGO_URL =
  "https://yqetuaoahwuqwsshkjnf.supabase.co/storage/v1/object/public/scriptovernovel.music-artworks/1786971924509-s3gurr.png";
