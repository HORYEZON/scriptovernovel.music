// One-off: point the tab icon at Tabler's vinyl record, cycling
// yellow → grey → white (Profile.faviconIcon / faviconIconColors — the
// same fields Preferences → Branding → Icons edits). Clears any uploaded
// Site Design favicon image so the catalog icon is what actually shows.
import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const profile = await prisma.profile.findFirst({ select: { id: true } });
  if (!profile) throw new Error("No Profile row");
  await prisma.profile.update({
    where: { id: profile.id },
    data: { faviconIcon: "tabler:vinyl", faviconIconColors: ["#FFD400", "#9A9A9A", "#FFFFFF"] },
  });
  await prisma.siteDesign.updateMany({ data: { faviconImage: null } });
  console.log("favicon → tabler:vinyl, colours yellow/grey/white");
}

main().finally(() => prisma.$disconnect());
