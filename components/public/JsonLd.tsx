// components/public/JsonLd.tsx
//
// Thin wrapper for embedding a schema.org JSON-LD <script> tag. No client
// JS, no dependencies — just a typed, reusable way to drop structured data
// onto a page (WebSite on the homepage, Person on About, Product +
// BreadcrumbList on artwork pages) instead of hand-rolling the same
// dangerouslySetInnerHTML boilerplate per page.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
