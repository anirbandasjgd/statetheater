import { PrismaClient } from "@prisma/client";
import { priceFor } from "../src/lib/pricing.ts";

if (!process.env.DATABASE_URL) {
  const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.replace(/\/$/, "");
  process.env.DATABASE_URL = mount ? `file:${mount}/prod.db` : "file:./dev.db";
}

const prisma = new PrismaClient();

async function main() {
  const seats = await prisma.seat.findMany({
    select: { id: true, section: true, row: true, block: true, type: true, price: true },
  });
  const updates = new Map<number, string[]>();
  for (const seat of seats) {
    const next = priceFor(seat.section, seat.row, seat.block, seat.type);
    if (next === seat.price) continue;
    const ids = updates.get(next) ?? [];
    ids.push(seat.id);
    updates.set(next, ids);
  }
  let changed = 0;
  for (const [price, ids] of updates) {
    const chunk = 200;
    for (let i = 0; i < ids.length; i += chunk) {
      await prisma.seat.updateMany({
        where: { id: { in: ids.slice(i, i + chunk) } },
        data: { price },
      });
    }
    changed += ids.length;
  }
  console.log(`Updated prices on ${changed} of ${seats.length} seats.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
