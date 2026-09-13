// app/(admin)/admin/api-docs/page.tsx
//
// Swagger UI rendered inside the admin panel.
// swagger-ui-react is browser-only (no SSR support), so it's loaded via a
// dynamic import with ssr: false to avoid hydration errors.
//
// Dark-mode strategy: pure CSS scoped to html.dark (ThemeToggle toggles this
// class; layout.tsx seeds it from localStorage on first paint). Light-mode
// resets use html:not(.dark) to beat swagger-ui-react v5's own built-in
// prefers-color-scheme:dark rules in swagger-ui.css.
"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-24 text-sm opacity-50">
      Loading API docs…
    </div>
  ),
});

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight text-ink dark:text-cream">
          API Documentation
        </h1>
        <p className="mt-1 text-sm text-ink-400 dark:text-ink-300">
          Interactive OpenAPI 3.0 reference for all ScriptOverNovel Music API routes.
          Admin endpoints accept either a session cookie{" "}
          <code className="font-mono text-xs bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded">
            authjs.session-token
          </code>{" "}
          or an{" "}
          <code className="font-mono text-xs bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded">
            x-api-key
          </code>{" "}
          header.
        </p>
      </div>

      {/* ── Swagger UI ─────────────────────────────────────────────────── */}
      <div className="swagger-wrapper">
        <SwaggerUI
          url="/api/openapi.json"
          displayRequestDuration
          persistAuthorization
          defaultModelsExpandDepth={-1}
          docExpansion="list"
          filter
        />
      </div>

      {/* ── Styles ─────────────────────────────────────────────────────── */}
      <style>{`
        /* ════════════════════════════════════════════════════════════
           LAYOUT — always applied
           ════════════════════════════════════════════════════════════ */
        .swagger-wrapper { padding: 0 0 4rem; }
        .swagger-wrapper .swagger-ui .topbar { display: none; }
        .swagger-wrapper .swagger-ui,
        .swagger-wrapper .swagger-ui * { font-family: inherit; }
        .swagger-wrapper .swagger-ui .info { margin: 1rem 0 0.5rem; }
        .swagger-wrapper .swagger-ui .info .title { font-size: 1.25rem; }

        /* ── Duplicate copy icon ────────────────────────────────────
           swagger-ui renders BOTH a bare <svg> AND a
           <button class="copy-to-clipboard"> inside the path span.
           Hide the bare SVG; keep the button.                       */
        .swagger-wrapper .swagger-ui .opblock-summary-path > svg { display: none !important; }
        .swagger-wrapper .swagger-ui .opblock-summary-path .copy-to-clipboard { display: inline-flex !important; }

        /* ════════════════════════════════════════════════════════════
           LIGHT MODE — html:not(.dark)
           swagger-ui-react v5 ships its own prefers-color-scheme:dark
           rules in swagger-ui.css that make scheme-container and the
           filter bar dark even when the admin ThemeToggle is on light.
           We override those back to Swagger's default light values
           using html:not(.dark) which beats the media-query specificity.
           ════════════════════════════════════════════════════════════ */
        html:not(.dark) .swagger-wrapper .swagger-ui .scheme-container {
          background: #fff !important;
          box-shadow: 0 1px 2px 0 rgba(0,0,0,.15) !important;
          border-bottom: none !important;
        }
        html:not(.dark) .swagger-wrapper .swagger-ui .filter-container {
          background: transparent !important;
          border-top: none !important;
          border-bottom: none !important;
        }
        html:not(.dark) .swagger-wrapper .swagger-ui .filter-container .operation-filter-input {
          background: #fff !important;
          color: #3b4151 !important;
          border-color: #d9d9d9 !important;
          box-shadow: inset 0 1px 1px rgba(0,0,0,.075) !important;
        }
        html:not(.dark) .swagger-wrapper .swagger-ui input,
        html:not(.dark) .swagger-wrapper .swagger-ui textarea,
        html:not(.dark) .swagger-wrapper .swagger-ui select {
          background: #fff !important;
          color: #3b4151 !important;
          border-color: #d9d9d9 !important;
        }
        html:not(.dark) .swagger-wrapper .swagger-ui { color: #3b4151; }
        html:not(.dark) .swagger-wrapper .swagger-ui p,
        html:not(.dark) .swagger-wrapper .swagger-ui h1,
        html:not(.dark) .swagger-wrapper .swagger-ui h2,
        html:not(.dark) .swagger-wrapper .swagger-ui h3,
        html:not(.dark) .swagger-wrapper .swagger-ui h4,
        html:not(.dark) .swagger-wrapper .swagger-ui h5,
        html:not(.dark) .swagger-wrapper .swagger-ui .opblock-tag,
        html:not(.dark) .swagger-wrapper .swagger-ui .opblock .opblock-summary-path,
        html:not(.dark) .swagger-wrapper .swagger-ui .opblock .opblock-summary-description { color: #3b4151; }
        html:not(.dark) .swagger-wrapper .swagger-ui svg { fill: #3b4151; }
        html:not(.dark) .swagger-wrapper .swagger-ui .dialog-ux .modal-ux,
        html:not(.dark) .swagger-wrapper .swagger-ui .dialog-ux .modal-ux-header,
        html:not(.dark) .swagger-wrapper .swagger-ui .dialog-ux .modal-ux-content {
          background: #fff !important;
          color: #3b4151 !important;
        }

        /* ════════════════════════════════════════════════════════════
           DARK MODE — html.dark
           ThemeToggle: document.documentElement.classList.toggle('dark')
           layout.tsx seeds this from localStorage on first paint.
           ════════════════════════════════════════════════════════════ */
        html.dark .swagger-wrapper .swagger-ui { color: #e2e8f0; }
        html.dark .swagger-wrapper .swagger-ui .wrapper { background: transparent; }

        /* Servers + Authorize bar */
        html.dark .swagger-wrapper .swagger-ui .scheme-container {
          background: #1e1e1e !important;
          box-shadow: none !important;
          border-bottom: 1px solid #2d2d2d !important;
        }
        html.dark .swagger-wrapper .swagger-ui .schemes > label,
        html.dark .swagger-wrapper .swagger-ui .servers > label { color: #e2e8f0; }
        html.dark .swagger-wrapper .swagger-ui .servers > label select {
          background: #2a2a2a !important;
          color: #e2e8f0 !important;
          border-color: #3d3d3d !important;
        }

        /* Filter by tag */
        html.dark .swagger-wrapper .swagger-ui .filter-container {
          background: #1a1a1a !important;
          border-top: 1px solid #2d2d2d;
          border-bottom: 1px solid #2d2d2d;
        }
        html.dark .swagger-wrapper .swagger-ui .filter-container .operation-filter-input {
          background: #242424 !important;
          color: #e2e8f0 !important;
          border-color: #3d3d3d !important;
          box-shadow: none !important;
        }
        html.dark .swagger-wrapper .swagger-ui .filter-container .operation-filter-input::placeholder {
          color: #555 !important;
        }

        /* Info block */
        html.dark .swagger-wrapper .swagger-ui .info .title,
        html.dark .swagger-wrapper .swagger-ui .info p,
        html.dark .swagger-wrapper .swagger-ui .info li,
        html.dark .swagger-wrapper .swagger-ui .info a { color: #e2e8f0; }

        /* All inputs / selects / textareas */
        html.dark .swagger-wrapper .swagger-ui input[type=text],
        html.dark .swagger-wrapper .swagger-ui input[type=email],
        html.dark .swagger-wrapper .swagger-ui input[type=password],
        html.dark .swagger-wrapper .swagger-ui textarea,
        html.dark .swagger-wrapper .swagger-ui select {
          background: #242424 !important;
          color: #e2e8f0 !important;
          border-color: #3d3d3d !important;
        }
        html.dark .swagger-wrapper .swagger-ui input::placeholder,
        html.dark .swagger-wrapper .swagger-ui textarea::placeholder { color: #555 !important; }

        /* Section headers */
        html.dark .swagger-wrapper .swagger-ui .opblock-tag { color: #e2e8f0; border-bottom-color: #2d2d2d; }
        html.dark .swagger-wrapper .swagger-ui .opblock-tag:hover { background: #242424; }
        html.dark .swagger-wrapper .swagger-ui .opblock-tag small { color: #9ca3af; }

        /* Opblock rows */
        html.dark .swagger-wrapper .swagger-ui .opblock.opblock-get    { background: rgba(97,175,254,.08); border-color: rgba(97,175,254,.3); }
        html.dark .swagger-wrapper .swagger-ui .opblock.opblock-post   { background: rgba(73,204,144,.08); border-color: rgba(73,204,144,.3); }
        html.dark .swagger-wrapper .swagger-ui .opblock.opblock-put    { background: rgba(252,161,48,.08);  border-color: rgba(252,161,48,.3); }
        html.dark .swagger-wrapper .swagger-ui .opblock.opblock-patch  { background: rgba(80,227,194,.08); border-color: rgba(80,227,194,.3); }
        html.dark .swagger-wrapper .swagger-ui .opblock.opblock-delete { background: rgba(249,62,62,.08);  border-color: rgba(249,62,62,.3); }
        html.dark .swagger-wrapper .swagger-ui .opblock .opblock-summary { background: transparent; }
        html.dark .swagger-wrapper .swagger-ui .opblock .opblock-summary-path,
        html.dark .swagger-wrapper .swagger-ui .opblock .opblock-summary-path span,
        html.dark .swagger-wrapper .swagger-ui .opblock .opblock-summary-description,
        html.dark .swagger-wrapper .swagger-ui .opblock .opblock-summary-operation-id { color: #e2e8f0; }

        /* Expanded opblock body */
        html.dark .swagger-wrapper .swagger-ui .opblock-body,
        html.dark .swagger-wrapper .swagger-ui .opblock-section,
        html.dark .swagger-wrapper .swagger-ui .opblock-section-header,
        html.dark .swagger-wrapper .swagger-ui .opblock-description-wrapper { background: #1e1e1e; border-color: #2d2d2d; }
        html.dark .swagger-wrapper .swagger-ui .opblock-section-header h4,
        html.dark .swagger-wrapper .swagger-ui .opblock-section-header label { color: #e2e8f0; }
        html.dark .swagger-wrapper .swagger-ui .tab li { color: #9ca3af; background: transparent; }
        html.dark .swagger-wrapper .swagger-ui .tab li.active { color: #e2e8f0; }

        /* Tables */
        html.dark .swagger-wrapper .swagger-ui table thead tr td,
        html.dark .swagger-wrapper .swagger-ui table thead tr th { background: #242424; border-color: #2d2d2d; color: #9ca3af; }
        html.dark .swagger-wrapper .swagger-ui .parameter__name,
        html.dark .swagger-wrapper .swagger-ui .parameter__in,
        html.dark .swagger-wrapper .swagger-ui .parameter__type,
        html.dark .swagger-wrapper .swagger-ui .parameters-col_description p,
        html.dark .swagger-wrapper .swagger-ui .response-col_status,
        html.dark .swagger-wrapper .swagger-ui .response-col_description,
        html.dark .swagger-wrapper .swagger-ui .col_header { color: #e2e8f0; }

        /* Code blocks */
        html.dark .swagger-wrapper .swagger-ui .microlight,
        html.dark .swagger-wrapper .swagger-ui .highlight-code,
        html.dark .swagger-wrapper .swagger-ui .response-col_description pre,
        html.dark .swagger-wrapper .swagger-ui .curl-command,
        html.dark .swagger-wrapper .swagger-ui .body-param textarea { background: #111 !important; color: #e2e8f0 !important; }

        /* Models */
        html.dark .swagger-wrapper .swagger-ui section.models { background: #1a1a1a; border-color: #2d2d2d; }
        html.dark .swagger-wrapper .swagger-ui section.models h4 { color: #e2e8f0; border-color: #2d2d2d; }
        html.dark .swagger-wrapper .swagger-ui .model-container,
        html.dark .swagger-wrapper .swagger-ui .model-box { background: #242424; border-color: #2d2d2d; }
        html.dark .swagger-wrapper .swagger-ui .model-title,
        html.dark .swagger-wrapper .swagger-ui .model,
        html.dark .swagger-wrapper .swagger-ui .prop-type,
        html.dark .swagger-wrapper .swagger-ui .prop-format { color: #e2e8f0; }

        /* Authorize modal */
        html.dark .swagger-wrapper .swagger-ui .dialog-ux .modal-ux,
        html.dark .swagger-wrapper .swagger-ui .dialog-ux .modal-ux-header,
        html.dark .swagger-wrapper .swagger-ui .dialog-ux .modal-ux-content { background: #1e1e1e !important; border-color: #2d2d2d !important; }
        html.dark .swagger-wrapper .swagger-ui .dialog-ux .modal-ux-header h3,
        html.dark .swagger-wrapper .swagger-ui .auth-container h4,
        html.dark .swagger-wrapper .swagger-ui .auth-container p,
        html.dark .swagger-wrapper .swagger-ui .auth-container label,
        html.dark .swagger-wrapper .swagger-ui .modal-ux-content p,
        html.dark .swagger-wrapper .swagger-ui .modal-ux-content label,
        html.dark .swagger-wrapper .swagger-ui .scopes h2 { color: #e2e8f0; }
        html.dark .swagger-wrapper .swagger-ui .scope-def { color: #9ca3af; }

        /* Misc */
        html.dark .swagger-wrapper .swagger-ui p,
        html.dark .swagger-wrapper .swagger-ui h1,
        html.dark .swagger-wrapper .swagger-ui h2,
        html.dark .swagger-wrapper .swagger-ui h3,
        html.dark .swagger-wrapper .swagger-ui h4,
        html.dark .swagger-wrapper .swagger-ui h5 { color: #e2e8f0; }
        html.dark .swagger-wrapper .swagger-ui a { color: #61afef; }
        html.dark .swagger-wrapper .swagger-ui svg { fill: #e2e8f0; }
        html.dark .swagger-wrapper .swagger-ui .expand-operation svg,
        html.dark .swagger-wrapper .swagger-ui .arrow { fill: #9ca3af; }
        html.dark .swagger-wrapper .swagger-ui .btn { background: transparent; }
        html.dark .swagger-wrapper .swagger-ui .btn.authorize { color: #61afef; border-color: #61afef; }
      `}</style>
    </div>
  );
}
