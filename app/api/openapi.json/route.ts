// app/api/openapi.json/route.ts
//
// Serves the OpenAPI 3.0 specification as JSON.
// Protected — only the admin panel's Swagger UI page calls this, and it's
// additionally gated behind requireAdmin() so the spec isn't publicly
// browsable even if someone discovers the endpoint.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { openApiSpec } from "@/lib/openapi";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  return NextResponse.json(openApiSpec, {
    headers: {
      // Swagger UI fetches this, no need to cache in CDN — always fresh.
      "Cache-Control": "no-store",
    },
  });
}
