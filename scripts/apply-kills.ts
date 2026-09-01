import { PrismaClient } from "@prisma/client";
import { isKillSeat } from "../src/lib/kills.ts";

if (!process.env.DATABASE_URL) {
  const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.replace(/\/$/, "");
  process.env.DATABASE_URL = mount ? `file:${mount}/prod.db` : "file:./dev.db";
}

const prisma = new PrismaClient();

async function main() {
  const seats = await prisma.seat.findMany({
    select: { id: true, section: true, block: true, row: true, number: true, status: true },
  });
  const killIds = seats
    .filter((s) => isKillSeat(s.section, s.row, s.number, s.block) && s.status !== "sold")
    .map((s) => s.id);
  if (killIds.length === 0) {
    console.log("No kill seats to update.");
    return;
  }
  await prisma.seat.updateMany({
    where: { id: { in: killIds } },
    data: { status: "blocked" },
  });
  const bySection = seats
    .filter((s) => killIds.includes(s.id))
    .reduce<Record<string, number>>((acc, s) => {
      acc[s.section] = (acc[s.section] ?? 0) + 1;
      return acc;
    }, {});
  console.log(
    `Marked ${killIds.length} seats as kills (${Object.entries(bySection)
      .map(([section, n]) => `${section} ${n}`)
      .join(", ")}).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
