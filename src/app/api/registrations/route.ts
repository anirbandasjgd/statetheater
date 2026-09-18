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
      select: {
        section: true,
        row: true,
        block: true,
        status: true,
        price: true,
        type: true,
        registrations: { select: { registration: { select: { excelTier: true } } } },
      },
    }),
  ]);

  return NextResponse.json({
    inventory: summarizeInventory(
      seats.map((seat) => ({
        section: seat.section,
        row: seat.row,
        block: seat.block,
        status: seat.status,
        price: seat.price,
        type: seat.type,
        excelTier: seat.registrations[0]?.registration.excelTier ?? "",
      })),
    ),
    registrations: registrations.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      ticketDelivered: r.ticketDelivered,
      isDiv: r.isDiv,
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

export async function PATCH(req: NextRequest) {
  const ok = await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "Missing registration id." }, { status: 400 });
  }

  if (typeof body?.isDiv === "boolean") {
    const updated = await prisma.registration.update({
      where: { id },
      data: { isDiv: body.isDiv },
      select: { id: true, isDiv: true },
    });
    return NextResponse.json(updated);
  }

  if (body?.ticketDelivered !== true) {
    return NextResponse.json(
      { error: "Registrations can only mark a ticket delivered. Undo that on the Database page." },
      { status: 400 },
    );
  }

  const updated = await prisma.registration.update({
    where: { id },
    data: { ticketDelivered: true },
    select: { id: true, ticketDelivered: true },
  });
  return NextResponse.json(updated);
}
