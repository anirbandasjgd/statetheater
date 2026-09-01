import { PrismaClient } from "@prisma/client";
import { isHoldSeat } from "../src/lib/holds.ts";

if (!process.env.DATABASE_URL) {
  const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.replace(/\/$/, "");
  process.env.DATABASE_URL = mount ? `file:${mount}/prod.db` : "file:./dev.db";
}

const prisma = new PrismaClient();

async function main() {
  const seats = await prisma.seat.findMany({
    select: { id: true, section: true, row: true, number: true, type: true, status: true },
  });
  const holdIds = seats
    .filter(
      (s) =>
        isHoldSeat(s.section, s.row, s.number) &&
        s.status !== "sold" &&
        (s.type !== "hold" || s.status !== "blocked"),
    )
    .map((s) => s.id);
  if (holdIds.length === 0) {
    console.log("No STNJ hold seats to update.");
    return;
  }
  await prisma.seat.updateMany({
    where: { id: { in: holdIds } },
    data: { type: "hold", status: "blocked" },
  });
  console.log(`Marked ${holdIds.length} orchestra seats as STNJ holds.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
