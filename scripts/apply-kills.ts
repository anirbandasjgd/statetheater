import { PrismaClient } from "@prisma/client";
import { isKillSeat } from "../src/lib/kills.ts";

if (!process.env.DATABASE_URL) {
  const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.replace(/\/$/, "");
  process.env.DATABASE_URL = mount ? `file:${mount}/prod.db` : "file:./dev.db";
}

const prisma = new PrismaClient();

async function main() {
  const seats = await prisma.seat.findMany({
    where: { section: "orchestra" },
    select: { id: true, row: true, number: true, status: true },
  });
  const killIds = seats.filter((s) => isKillSeat("orchestra", s.row, s.number) && s.status !== "sold").map((s) => s.id);
  if (killIds.length === 0) {
    console.log("No kill seats to update.");
    return;
  }
  await prisma.seat.updateMany({
    where: { id: { in: killIds } },
    data: { status: "blocked" },
  });
  console.log(`Marked ${killIds.length} orchestra seats as kills.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
