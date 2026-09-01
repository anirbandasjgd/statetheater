import { PrismaClient } from "@prisma/client";
import { isAdaSeat } from "../src/lib/ada.ts";

if (!process.env.DATABASE_URL) {
  const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.replace(/\/$/, "");
  process.env.DATABASE_URL = mount ? `file:${mount}/prod.db` : "file:./dev.db";
}

const prisma = new PrismaClient();

async function main() {
  const seats = await prisma.seat.findMany({
    select: { id: true, section: true, block: true, row: true, number: true, type: true },
  });
  const adaIds = seats
    .filter((s) => isAdaSeat(s.section, s.row, s.number, s.block) && s.type !== "ada")
    .map((s) => s.id);
  if (adaIds.length === 0) {
    console.log("No ADA seats to update.");
    return;
  }
  await prisma.seat.updateMany({
    where: { id: { in: adaIds } },
    data: { type: "ada" },
  });
  const bySection = seats
    .filter((s) => adaIds.includes(s.id))
    .reduce<Record<string, number>>((acc, s) => {
      acc[s.section] = (acc[s.section] ?? 0) + 1;
      return acc;
    }, {});
  console.log(
    `Marked ${adaIds.length} seats as ADA (${Object.entries(bySection)
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
