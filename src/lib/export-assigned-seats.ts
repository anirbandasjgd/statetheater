import ExcelJS from "exceljs";
import type { PrismaClient } from "@prisma/client";
import { formatRegisteredAt } from "./datetime";
import { seatLabel } from "./seats";

function sortSeats<T extends { section: string; x: number; y: number; row: string; number: number }>(seats: T[]) {
  return [...seats].sort(
    (a, b) => a.section.localeCompare(b.section) || a.y - b.y || a.x - b.x || a.row.localeCompare(b.row) || a.number - b.number,
  );
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
  }

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
