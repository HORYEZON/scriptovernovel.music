// prisma/seed-orders.ts
//
// Fills the Order table with believable demo orders so the Orders module and
// the Sales Dashboard have something to show before the shop has real sales.
//
//   yarn db:seed:orders            # add ~60 demo orders over the last 12 months
//   yarn db:seed:orders 120        # add 120 instead
//   yarn db:seed:orders --clean    # remove every demo order, leave real ones
//
// Safety: this NEVER deletes anything except its own rows. Demo orders are
// stamped with a `KAL-DEMO-…` paymongoRef and that prefix is the only thing
// --clean matches on, so a real PayMongo order (`KAL-<timestamp>-<hex>`) can
// never be caught by it. Unlike prisma/seed.ts, nothing here truncates tables.
import "dotenv/config";
import { PrismaClient, type OrderStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/** Marks a row as ours. Everything in this file keys off this prefix. */
const DEMO_PREFIX = "KAL-DEMO-";

const FIRST_NAMES = [
  "Maria", "Jose", "Andrea", "Miguel", "Sofia", "Gabriel", "Isabella", "Rafael",
  "Camille", "Diego", "Nicole", "Paolo", "Bianca", "Enzo", "Trisha", "Marco",
  "Hannah", "Luis", "Patricia", "Kier", "Aya", "Renz", "Divine", "Joaquin",
];

const LAST_NAMES = [
  "Santos", "Reyes", "Cruz", "Bautista", "Ocampo", "Del Rosario", "Villanueva",
  "Mendoza", "Aquino", "Torres", "Ramos", "Garcia", "Flores", "Domingo",
  "Navarro", "Salazar", "Fernandez", "Gonzales",
];

const CITIES = [
  "Makati City", "Quezon City", "Cebu City", "Davao City", "Pasig City",
  "Baguio City", "Iloilo City", "Taguig City", "Antipolo City", "Bacolod City",
];

const STREETS = [
  "Mabini St.", "Rizal Ave.", "Katipunan Ave.", "Bonifacio Drive", "Aguinaldo St.",
  "Lopez Jaena St.", "Del Pilar St.", "Luna St.", "Quezon Blvd.",
];

const NOTES = [
  null, null, null, // most orders carry no note
  "Please leave with the building guard.",
  "Gift — no invoice in the package, please.",
  "Ring the doorbell twice, dog in the yard.",
  "Weekend delivery preferred.",
  "Call before delivery, I work night shift.",
];

/**
 * How the demo order book is shaped. Weighted so the result looks like a real
 * shop rather than a uniform sample: mostly fulfilled business, a live tail of
 * pending/shipped, and a thin edge of failures and cancellations.
 */
const STATUS_WEIGHTS: [OrderStatus, number][] = [
  ["DELIVERED", 38],
  ["SHIPPED", 18],
  ["PAID", 20],
  ["PENDING", 12],
  ["CANCELLED", 7],
  ["FAILED", 5],
];

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

function weightedStatus(): OrderStatus {
  const total = STATUS_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [status, weight] of STATUS_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return status;
  }
  return "PAID";
}

/**
 * A date in the last `months` months, biased towards recent.
 *
 * Two-tier rather than one smooth curve, and deliberately so: the Sales
 * Dashboard opens on its 30-day range, so a purely random spread can leave the
 * first thing you see empty — which is exactly what happened seeding a handful
 * of orders across a year. Forcing ~45% of orders into the last 30 days means
 * the default view always has something in it, however few you seed, while the
 * squared tail still slopes the 12-month chart like a growing shop.
 */
function pastDate(months = 12): Date {
  const daysBack =
    Math.random() < 0.45
      ? randInt(0, 29)
      : Math.floor(30 + Math.pow(Math.random(), 2) * (months * 30 - 30));
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(randInt(8, 22), randInt(0, 59), randInt(0, 59), 0);
  return d;
}

function demoRef(date: Date): string {
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${DEMO_PREFIX}${stamp}-${suffix}`;
}

async function clean() {
  const demoOrders = await prisma.order.findMany({
    where: { paymongoRef: { startsWith: DEMO_PREFIX } },
    select: { id: true },
  });

  if (demoOrders.length === 0) {
    console.log("Nothing to clean — no demo orders found.");
    return;
  }

  const ids = demoOrders.map((o) => o.id);
  // OrderItem cascades on Order delete, but deleting explicitly keeps this
  // honest about what it touches.
  await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.order.deleteMany({ where: { id: { in: ids } } });
  console.log(`🧹 Removed ${ids.length} demo order(s). Real orders untouched.`);
}

async function seed(count: number) {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: { artwork: { select: { title: true } }, variants: true },
  });

  if (products.length === 0) {
    console.error(
      "✋ No products found. Demo orders have to reference real products —\n" +
        "   add some in /admin/products (or run `yarn db:seed`) and try again."
    );
    process.exitCode = 1;
    return;
  }

  console.log(`📦 ${products.length} product(s) available. Creating ${count} demo order(s)…`);

  let created = 0;
  let revenue = 0;

  for (let i = 0; i < count; i++) {
    const createdAt = pastDate();
    const status = weightedStatus();
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const customerName = `${firstName} ${lastName}`;
    const customerEmail = `${firstName}.${lastName}`
      .toLowerCase()
      .replace(/[^a-z.]/g, "") + `${randInt(1, 99)}@example.com`;

    // 1–3 distinct products per order.
    const lineCount = Math.min(randInt(1, 3), products.length);
    const chosen = [...products].sort(() => Math.random() - 0.5).slice(0, lineCount);

    const items = chosen.map((product) => {
      const variant = product.variants.length > 0 ? pick(product.variants) : null;
      return {
        productId: product.id,
        quantity: randInt(1, 3),
        price: variant ? variant.price : product.price,
        variantId: variant?.id ?? null,
        variantLabel: variant?.label ?? null,
      };
    });

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // A slice of the older, finished business starts out archived, so the
    // Orders module's Archived tab isn't empty on first look.
    const isFinished = status === "DELIVERED" || status === "CANCELLED";
    const isOld = Date.now() - createdAt.getTime() > 90 * 24 * 60 * 60 * 1000;
    const archivedAt = isFinished && isOld && Math.random() < 0.5 ? new Date() : null;

    await prisma.order.create({
      data: {
        customerName,
        customerEmail,
        status,
        total,
        // Only orders that actually cleared carry a payment id.
        paymentId:
          status === "PENDING" || status === "FAILED"
            ? null
            : `pay_demo_${Math.random().toString(36).slice(2, 14)}`,
        paymongoRef: demoRef(createdAt),
        shippingAddress: `${randInt(1, 999)} ${pick(STREETS)}, ${pick(CITIES)}, Philippines`,
        shippingPhone: `+639${randInt(10, 99)}${randInt(1000000, 9999999)}`,
        deliveryNotes: pick(NOTES),
        createdAt,
        updatedAt: createdAt,
        archivedAt,
        items: { create: items },
      },
    });

    created++;
    if (["PAID", "SHIPPED", "DELIVERED"].includes(status)) revenue += total;
  }

  console.log(`✅ Created ${created} demo order(s).`);
  console.log(
    `💰 Of those, ₱${revenue.toLocaleString("en-PH")} counts as revenue ` +
      "(PAID / SHIPPED / DELIVERED)."
  );
  console.log(`ℹ️  Remove them any time with: yarn db:seed:orders --clean`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--clean")) {
    await clean();
    return;
  }

  const countArg = args.find((a) => /^\d+$/.test(a));
  const count = countArg ? Number(countArg) : 60;

  if (count < 1 || count > 1000) {
    console.error("Count must be between 1 and 1000.");
    process.exitCode = 1;
    return;
  }

  await seed(count);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
