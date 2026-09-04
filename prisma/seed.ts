import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { priceFor } from "../src/lib/pricing.ts";
import { isAdaSeat } from "../src/lib/ada.ts";
import { isHoldSeat } from "../src/lib/holds.ts";
import { isKillSeat } from "../src/lib/kills.ts";

if (!process.env.DATABASE_URL) {
  const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.replace(/\/$/, "");
  process.env.DATABASE_URL = mount ? `file:${mount}/prod.db` : "file:./dev.db";
}

const prisma = new PrismaClient();

type RawSeat = {
  section: string;
  block: string;
  row: string;
  number: number;
  type: string;
  price: number;
  x: number;
  y: number;
};

function load(name: string): RawSeat[] {
  const path = resolve(process.cwd(), "data", `${name}.json`);
  return JSON.parse(readFileSync(path, "utf8")) as RawSeat[];
}

async function main() {
  const seats = [...load("orchestra"), ...load("balcony")];
  const usedIds = new Set<string>();

  const rows = seats.map((s) => {
    let id = `${s.section}:${s.block}:${s.row}:${s.number}`;
    if (usedIds.has(id)) {
      id = `${id}:${s.x.toFixed(1)}:${s.y.toFixed(1)}`;
    }
    usedIds.add(id);
    const type = isHoldSeat(s.section, s.row, s.number)
      ? "hold"
      : isAdaSeat(s.section, s.row, s.number, s.block)
        ? "ada"
        : s.type;
    return {
      id,
      section: s.section,
      block: s.block,
      row: s.row,
      number: s.number,
      type,
      price: priceFor(s.section, s.row, s.block, type),
      x: s.x,
      y: s.y,
      status:
        isKillSeat(s.section, s.row, s.number, s.block) || isHoldSeat(s.section, s.row, s.number)
          ? "blocked"
          : "available",
    };
  });

  await prisma.registrationSeat.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.seat.deleteMany();

  const chunk = 150;
  for (let i = 0; i < rows.length; i += chunk) {
    await prisma.seat.createMany({ data: rows.slice(i, i + chunk) });
  }

  const counts = await prisma.seat.groupBy({
    by: ["section"],
    _count: true,
  });
  console.log(`Seeded ${rows.length} seats`, counts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
