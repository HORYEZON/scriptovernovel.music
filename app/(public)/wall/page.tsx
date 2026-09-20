// app/(public)/wall/page.tsx
//
// Short address for the Freedom Wall ("Fan Wall" on the band site). The
// wall itself still lives at /gallery/museum's sibling route because the
// Digital Museum's Freedom Wall room links there and is left as is.
import { redirect } from "next/navigation";

export default function WallAlias() {
  redirect("/gallery/freedom-wall");
}
