// prisma/seed.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧹 Cleaning up existing data...");
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.artwork.deleteMany();
  await prisma.section.deleteMany();
  await prisma.certificateAward.deleteMany();
  await prisma.socialLink.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
  console.log("✨ Existing data cleaned without dropping tables!");

  // Seed admin user
  const hashedPassword = await bcrypt.hash("k4l4m4r1.4rts!", 10);
  const admin = await prisma.user.upsert({
    where: { email: "kylamarie.zuniga@gmail.com" },
    update: {},
    create: {
      email: "kylamarie.zuniga@gmail.com",
      name: "ScriptOverNovel Admin",
      password: hashedPassword,
      role: "ADMIN",
    },
  });
  console.log("✅ Admin user:", admin.email);

  // Seed profile
  await prisma.profile.upsert({
    where: { id: "default-profile" },
    update: {},
    create: {
      id: "default-profile",
      bio: "Insert your bio here",
      headline: "Insert your headline here",
      email: "email.example@gmail.com",
    },
  });
  console.log("✅ Profile seeded");

  // Seed artworks
  const artworks = [
    {
      title: "Artworks 1",
      description: "Description 1",
      imageUrl: "https://picsum.photos/seed/dagat/800/600",
      tags: ["tag 1", "tag 2", "tag 3", "featured"],
      medium: "Medium 1",
      dimensions: "Dimensions 1",
      year: 2026,
      featured: true,
    },
    {
      title: "Artworks 2",
      description:
        "Description 2",
      imageUrl: "https://picsum.photos/seed/bahay/800/600",
      tags: ["tag 1", "tag 2", "tag 3", "featured"],
      medium: "Mixed Media",
      dimensions: "Dimensions 2",
      year: 2026,
      featured: true,
    },
    {
      title: "Artworks 3",
      description:
        "Description 3",
      imageUrl: "https://picsum.photos/seed/likhang/800/600",
      tags: ["tag 1", "tag 2", "tag 3"],
      medium: "Medium 3",
      dimensions: "Dimensions 3",
      year: 2026,
    },
    {
      title: "Artworks 4",
      description:
        "Description 4",
      imageUrl: "https://picsum.photos/seed/archipelago/800/600",
      tags: ["tag 1", "tag 2", "tag 3", "featured"],
      medium: "Medium 4",
      dimensions: "Dimensions 4",
      year: 2026,
      featured: true,
    },
    {
      title: "Artworks 5",
      description:
        "Description 5",
      imageUrl: "https://picsum.photos/seed/sintang/800/600",
      tags: ["tag 1", "tag 2", "tag 3", "featured"],
      medium: "Medium 5",
      dimensions: "Dimensions 5",
      year: 2026,
    },
    {
      title: "Artworks 6",
      description:
        "Description 6",
      imageUrl: "https://picsum.photos/seed/bulalakaw/800/600",
      tags: ["tag 1", "tag 2", "tag 3", "featured"],
      medium: "Medium 6",
      dimensions: "Dimensions 6",
      year: 2026,
    },
  ];

  for (const artwork of artworks) {
    const created = await prisma.artwork.create({ data: artwork });

    // Create products for first 4 artworks
    const idx = artworks.indexOf(artwork);
    if (idx < 4) {
      await prisma.product.create({
        data: {
          artworkId: created.id,
          price: [28000, 18000, 12000, 35000][idx],
          stock: [1, 1, 3, 1][idx],
          available: true,
        },
      });
    }
    console.log(`✅ Artwork: ${artwork.title}`);
  }

  console.log("\n🎨 ScriptOverNovel seeded successfully!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
