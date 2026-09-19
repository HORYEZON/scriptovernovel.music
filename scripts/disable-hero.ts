// One-off: switch the homepage hero off (Site Design → Homepage Hero →
// "Show the hero"), so the homepage opens straight on the collection.
import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const r = await prisma.siteDesign.updateMany({ data: { heroEnabled: false } });
  console.log(`hero disabled on ${r.count} row(s)`);
}

main().finally(() => prisma.$disconnect());
