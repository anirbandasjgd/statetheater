import ExcelJS from "exceljs";
import type { PrismaClient } from "@prisma/client";
import { formatRegisteredAt } from "./datetime";
import { tierFor } from "./pricing";
import { seatLabel } from "./seats";

function sortSeats<T extends { section: string; x: number; y: number; row: string; number: number }>(seats: T[]) {
  return [...seats].sort(
    (a, b) => a.section.localeCompare(b.section) || a.y - b.y || a.x - b.x || a.row.localeCompare(b.row) || a.number - b.number,
  );
}

function assignedTierLabel(seats: { section: string; row: string; block: string }[]) {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const seat of seats) {
    const section = seat.section === "orchestra" ? "Orchestra" : "Balcony";
    const label = `${section} ${tierFor(seat.section, seat.row, seat.block)}`;
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels.join(", ");
}

export async function buildAssignedSeatsWorkbook(prisma: PrismaClient) {
  const registrations = await prisma.registration.findMany({
    orderBy: { createdAt: "asc" },
    include: { seats: { include: { seat: true } } },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "State Theatre NJ";
  const sheet = workbook.addWorksheet("Assigned seats");
  sheet.columns = [
    { header: "Registered", key: "registered", width: 24 },
    { header: "Participants", key: "name", width: 48 },
    { header: "Tier", key: "tier", width: 28 },
    { header: "Number of seats", key: "seatCount", width: 16 },
    { header: "Seats", key: "seats", width: 72 },
  ];
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.commit();

  for (const row of registrations) {
    const seats = sortSeats(row.seats.map((link) => link.seat));
    const added = sheet.addRow({
      registered: formatRegisteredAt(row.createdAt),
      name: row.name,
      tier: assignedTierLabel(seats),
      seatCount: seats.length,
      seats: seats
        .map((seat) =>
          seatLabel({
            section: seat.section as "orchestra" | "balcony",
            block: seat.block,
            row: seat.row,
            number: seat.number,
          }),
        )
        .join(", "),
    });
    added.getCell(1).alignment = { vertical: "middle" };
    added.getCell("seatCount").alignment = { horizontal: "center", vertical: "middle" };
  }

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
