import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { isHoldSeat } from "../src/lib/holds.ts";
import { isAdaSeat } from "../src/lib/ada.ts";
import { isKillSeat } from "../src/lib/kills.ts";
import { priceFor } from "../src/lib/pricing.ts";

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
  x: number;
  y: number;
};

function seatId(seat: Pick<RawSeat, "section" | "block" | "row" | "number">) {
  return `${seat.section}:${seat.block}:${seat.row}:${seat.number}`;
}

async function main() {
  const seats = await prisma.seat.findMany({
    select: { id: true, section: true, block: true, row: true, number: true, type: true, status: true },
  });
  const byId = new Map(seats.map((s) => [s.id, s]));

  const orchestra = JSON.parse(readFileSync(resolve(process.cwd(), "data/orchestra.json"), "utf8")) as RawSeat[];
  const missingSeats = orchestra.filter((s) => !byId.has(seatId(s)));
  if (missingSeats.length) {
    await prisma.seat.createMany({
      data: missingSeats.map((s) => {
        const hold = isHoldSeat(s.section, s.row, s.number);
        const kill = isKillSeat(s.section, s.row, s.number, s.block);
        const ada = isAdaSeat(s.section, s.row, s.number, s.block);
        return {
          id: seatId(s),
          section: s.section,
          block: s.block,
          row: s.row,
          number: s.number,
          type: hold ? "hold" : ada ? "ada" : s.type,
          price: priceFor(s.section, s.row, s.block, hold ? "hold" : ada ? "ada" : s.type),
          x: s.x,
          y: s.y,
          status: hold || kill ? "blocked" : "available",
        };
      }),
    });
    console.log(`Added ${missingSeats.length} missing orchestra seats.`);
  }

  const refreshed = missingSeats.length
    ? await prisma.seat.findMany({
        select: { id: true, section: true, block: true, row: true, number: true, type: true, status: true },
      })
    : seats;

  const holdIds = refreshed
    .filter(
      (s) =>
        isHoldSeat(s.section, s.row, s.number) &&
        s.status !== "sold" &&
        (s.type !== "hold" || s.status !== "blocked"),
    )
    .map((s) => s.id);
  if (holdIds.length) {
    await prisma.seat.updateMany({
      where: { id: { in: holdIds } },
      data: { type: "hold", status: "blocked" },
    });
    console.log(`Marked ${holdIds.length} orchestra seats as STNJ holds.`);
  }

  const released = refreshed.filter(
    (s) =>
      s.type === "hold" &&
      !isHoldSeat(s.section, s.row, s.number) &&
      s.status !== "sold",
  );
  for (const seat of released) {
    const kill = isKillSeat(seat.section, seat.row, seat.number, seat.block);
    const ada = isAdaSeat(seat.section, seat.row, seat.number, seat.block);
    await prisma.seat.update({
      where: { id: seat.id },
      data: {
        type: ada ? "ada" : "standard",
        status: kill ? "blocked" : "available",
      },
    });
  }
  if (released.length) {
    console.log(`Released ${released.length} former STNJ holds back to sellable seats.`);
  }
  if (!missingSeats.length && !holdIds.length && !released.length) {
    console.log("STNJ holds already up to date.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
