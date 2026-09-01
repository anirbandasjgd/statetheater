import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import { summarizeInventory } from "@/lib/inventory";

export async function GET(req: NextRequest) {
  const ok = await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [registrations, seats] = await Promise.all([
    prisma.registration.findMany({
      orderBy: { createdAt: "desc" },
      include: { seats: { include: { seat: true } } },
    }),
    prisma.seat.findMany({
      select: { section: true, row: true, block: true, status: true },
    }),
  ]);

  return NextResponse.json({
    inventory: summarizeInventory(seats),
    registrations: registrations.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      createdAt: r.createdAt,
      total: r.seats.reduce((sum, rs) => sum + rs.seat.price, 0),
      seats: r.seats.map((rs) => ({
        id: rs.seat.id,
        section: rs.seat.section,
        block: rs.seat.block,
        row: rs.seat.row,
        number: rs.seat.number,
        price: rs.seat.price,
        type: rs.seat.type,
      })),
    })),
  });
}
