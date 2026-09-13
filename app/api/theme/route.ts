// app/api/theme/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SITE_THEME, resolveSiteTheme, sanitizeThemeInput } from "@/lib/theme";

export async function GET() {
  try {
    const theme = await prisma.siteTheme.findFirst();
    return NextResponse.json(resolveSiteTheme(theme));
  } catch {
    return NextResponse.json(DEFAULT_SITE_THEME);
  }
}

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const clean = sanitizeThemeInput(body);

    // adminBackgroundImage (app/(admin)/layout.tsx's own background photo)
    // lives on SiteTheme but is deliberately outside SiteThemeSettings/
    // sanitizeThemeInput — see prisma/schema.prisma's comment on the column.
    // Passed straight through, same convention as Profile.backgroundImage/
    // logoImage in app/api/profile/route.ts (a URL, not a themed value, so
    // there's nothing to validate beyond "is it present").
    const { adminBackgroundImage } = body as { adminBackgroundImage?: unknown };
    const cleanAdminBackgroundImage =
      adminBackgroundImage === undefined
        ? undefined
        : typeof adminBackgroundImage === "string"
          ? adminBackgroundImage
          : null;

    if (Object.keys(clean).length === 0 && cleanAdminBackgroundImage === undefined) {
      return NextResponse.json(
        { error: "No valid theme values provided" },
        { status: 400 }
      );
    }
    // Reject the request outright if anything failed validation, rather than
    // silently dropping it — the admin form should always know what stuck.
    const rejected = Object.keys(body).filter(
      (key) => key in DEFAULT_SITE_THEME && !(key in clean)
    );
    if (rejected.length > 0) {
      return NextResponse.json(
        { error: `Invalid value(s) for: ${rejected.join(", ")}` },
        { status: 400 }
      );
    }

    const cleanWithImage = {
      ...clean,
      ...(cleanAdminBackgroundImage !== undefined && {
        adminBackgroundImage: cleanAdminBackgroundImage,
      }),
    };

    const theme = await prisma.siteTheme.upsert({
      where: { id: "default-theme" },
      update: cleanWithImage,
      create: { id: "default-theme", ...DEFAULT_SITE_THEME, ...cleanWithImage },
    });

    revalidatePath("/", "layout");
    return NextResponse.json(resolveSiteTheme(theme));
  } catch (err) {
    console.error("[PUT /api/theme]", err);
    return NextResponse.json({ error: "Failed to update theme" }, { status: 500 });
  }
}
