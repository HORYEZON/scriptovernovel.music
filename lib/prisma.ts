// lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Strip accidental wrapping quotes (e.g. value pasted from .env into Vercel).
// `pg` treats a quoted/empty string as "no host" and silently falls back to
// 127.0.0.1:5432, so fail loudly instead.
const connectionString = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
