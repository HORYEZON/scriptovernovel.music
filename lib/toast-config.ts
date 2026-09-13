// lib/toast-config.ts
// Shared react-hot-toast look — a small "glass" card that matches the
// rounded / backdrop-blur / alpha-border language used across the rest of
// the site (admin modals, public lightboxes, etc.) instead of the old flat
// sharp-cornered chip. Used by both layouts so admin and public toasts stay
// visually identical; update once here rather than in two places.
import type { ToasterProps } from "react-hot-toast";

const BASE_STYLE = {
  background: "rgba(13, 13, 13, 0.94)",
  color: "#FAF8F3",
  fontFamily: "var(--font-dm-sans)",
  fontSize: "14px",
  lineHeight: "1.4",
  borderRadius: "14px",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  boxShadow: "0 12px 32px rgba(0, 0, 0, 0.35)",
  backdropFilter: "blur(12px)",
  padding: "12px 16px",
} as const;

// Brand-matched accents: emerald reads as "success" everywhere else in the
// admin (published/live/available badges), vermillion is the site's own
// alert colour (Sold ribbons, delete confirmations) rather than a generic red.
const SUCCESS_COLOR = "#10B981";
const ERROR_COLOR = "#D94F38";

export const TOAST_OPTIONS: ToasterProps["toastOptions"] = {
  duration: 3500,
  style: BASE_STYLE,
  success: {
    duration: 3000,
    iconTheme: { primary: SUCCESS_COLOR, secondary: "#0D0D0D" },
    style: { border: `1px solid ${SUCCESS_COLOR}40` },
  },
  error: {
    duration: 4500,
    iconTheme: { primary: ERROR_COLOR, secondary: "#FAF8F3" },
    style: { border: `1px solid ${ERROR_COLOR}4D` },
  },
  loading: {
    iconTheme: { primary: "#C8A96E", secondary: "#0D0D0D" }, // sepia
  },
};
