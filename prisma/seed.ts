import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const ROW_ORDER = [
  "PA", "PB",
  "A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N",
  "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  "AA", "BB", "CC", "DD",
];
const ROW_INDEX = Object.fromEntries(ROW_ORDER.map((r, i) => [r, i]));

/** Tentative prices — edit here and re-run `npm run db:seed`. */
function priceFor(section: string, row: string): number {
  const idx = ROW_INDEX[row];
  if (section === "orchestra") {
    if (row === "PA" || row === "PB") return 175;
    if (idx !== undefined && idx >= ROW_INDEX.A && idx <= ROW_INDEX.F) return 150;
    if (idx !== undefined && idx >= ROW_INDEX.G && idx <= ROW_INDEX.N) return 100;
    return 50;
  }
  if (idx !== undefined && idx >= ROW_INDEX.A && idx <= ROW_INDEX.C) return 100;
  if (row === "A" || row === "B") return 100;
  return 50;
}

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
    return {
      id,
      section: s.section,
      block: s.block,
      row: s.row,
      number: s.number,
      type: s.type,
      price: priceFor(s.section, s.row),
      x: s.x,
      y: s.y,
      status: "available",
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
