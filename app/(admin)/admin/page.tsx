// app/(admin)/admin/page.tsx
// The dashboard now lives at /admin/dashboard. This stub keeps old
// bookmarks/links to bare /admin (and the middleware's callbackUrl for
// unauthenticated hits on "/admin") working instead of 404ing.
import { redirect } from "next/navigation";

export default function AdminIndexRedirect() {
  redirect("/admin/dashboard");
}
