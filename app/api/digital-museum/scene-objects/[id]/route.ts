// app/api/digital-museum/scene-objects/[id]/route.ts
//
// Backs the Museum Scene Editor's Save (PATCH — persist a dragged
// position/rotation, or `{ restore: true }` to undelete a just-removed
// object — see the editor's quick "Restore" action) and Remove (DELETE —
// soft delete, same pattern as everything else in this admin) actions.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorCode } from "@/lib/utils";

function revalidateMuseumPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/artworks");
  revalidatePath("/gallery/museum");
}

// PATCH /api/digital-museum/scene-objects/[id] — save a dragged
// position/rotation, optional uniform scale (custom .glb props only),
// optional label (custom .glb prop display name; null clears it),
// optional solid/colliderRadius/colliderOffsetX/colliderOffsetZ/colliderHeight (custom .glb
// prop player-collision footprint and where it sits on the model;
// colliderRadius null = auto), optional modelUrl (text label
// JSON config or About-block plaque JSON config), and/or `restore: true`
// to undelete.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const { positionX, positionY, positionZ, rotationY, scale, restore, modelUrl, label, solid, colliderRadius, colliderOffsetX, colliderOffsetZ, colliderHeight, colliderBaseY, hidden } = body;

    const data: Record<string, number | string | boolean | Date | null> = {};
    for (const [key, value] of Object.entries({ positionX, positionY, positionZ, rotationY, scale })) {
      if (value === undefined) continue;
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data[key] = value;
    }
    // modelUrl carries text-label config (TextObjectConfig JSON) or About-room
    // plaque display config (PlaqueConfig JSON) — allow null to clear it.
    if (modelUrl !== undefined) {
      if (modelUrl !== null && typeof modelUrl !== "string") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.modelUrl = modelUrl;
    }
    // label — admin-chosen display name for a custom .glb prop; null clears
    // it back to the generic "Decorative Object" label.
    if (label !== undefined) {
      if (label !== null && typeof label !== "string") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.label = label === null ? null : label.trim().slice(0, 80) || null;
    }
    // solid / colliderRadius — player-collision footprint for a custom .glb
    // prop (see the editor's Solid toggle). colliderRadius null = "auto".
    if (solid !== undefined) {
      if (typeof solid !== "boolean") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.solid = solid;
    }
    // hidden — the admin's "Hide from Museum" switch. Kept apart from
    // `deletedAt`: the row and everything configured on it stay exactly as
    // they are, it just isn't in the room visitors walk into. See
    // MuseumSceneObject.hidden in the schema for why the fixtures need this
    // rather than a delete.
    if (hidden !== undefined) {
      if (typeof hidden !== "boolean") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.hidden = hidden;
    }
    if (colliderRadius !== undefined) {
      if (colliderRadius !== null && (typeof colliderRadius !== "number" || !Number.isFinite(colliderRadius))) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.colliderRadius = colliderRadius;
    }
    // colliderHeight — how tall that circle stands, model units, measured up
    // from the prop's own base. Nullable like the radius, and null is load-
    // bearing here: it means "floor to ceiling", the only behaviour there was
    // before this column, and is what clearing the slider writes back.
    if (colliderHeight !== undefined) {
      if (colliderHeight !== null && (typeof colliderHeight !== "number" || !Number.isFinite(colliderHeight))) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.colliderHeight = colliderHeight;
    }
    // colliderOffsetX/Z — where that circle sits relative to the model's own
    // origin, in the same model units and in the prop's own rotated frame.
    // Not nullable the way the radius is: 0 already means "on the origin",
    // which is both the default and the old behaviour, so there is nothing
    // for a null to say here.
    // colliderBaseY — how far that column is lifted off the prop's own base.
    // Not nullable, like the offsets below and unlike the height above: 0 is
    // a real position ("standing on the base") rather than an absence, so
    // there is nothing a null would mean here that 0 doesn't already say.
    for (const [key, value] of Object.entries({ colliderOffsetX, colliderOffsetZ, colliderBaseY })) {
      if (value === undefined) continue;
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data[key] = value;
    }
    if (restore === true) {
      data.deletedAt = null;
    } else if (restore !== undefined) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // A save aimed at an object that has since been removed writes into
    // nothing anyone will ever see, so say so instead of reporting success.
    // This is how a swapped Contact Desk model went missing: the fixture was
    // removed in one tab and re-provisioned as a new row, while an older tab
    // went on holding the removed one and saved an uploaded .glb onto it —
    // saved, confirmed, and invisible in the museum. `restore` is exempt,
    // since undeleting is the one thing a removed row is still for.
    if (restore !== true) {
      const current = await prisma.museumSceneObject.findUnique({
        where: { id },
        select: { deletedAt: true },
      });
      if (!current) {
        return NextResponse.json({ error: "Object not found" }, { status: 404 });
      }
      if (current.deletedAt) {
        return NextResponse.json(
          { error: "This object was removed from the room — reload the scene and try again." },
          { status: 409 }
        );
      }
    }

    const object = await prisma.museumSceneObject.update({ where: { id }, data });

    revalidateMuseumPaths();

    return NextResponse.json(object);
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Object not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update object" }, { status: 500 });
  }
}

// DELETE /api/digital-museum/scene-objects/[id] — soft delete
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    await prisma.museumSceneObject.update({ where: { id }, data: { deletedAt: new Date() } });

    revalidateMuseumPaths();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Failed to delete object" }, { status: 500 });
  }
}
