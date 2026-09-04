import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

const TABLES = ["seat", "registration", "registrationSeat"] as const;
type TableName = (typeof TABLES)[number];
const PAGE_SIZE = 50;

function isTable(value: string): value is TableName {
  return (TABLES as readonly string[]).includes(value);
}

async function requireAdmin(req: NextRequest) {
  return verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tableParam = req.nextUrl.searchParams.get("table") ?? "";
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1") || 1);

  const [seatCount, registrationCount, registrationSeatCount] = await Promise.all([
    prisma.seat.count(),
    prisma.registration.count(),
    prisma.registrationSeat.count(),
  ]);

  const tables = [
    { id: "seat", name: "Seat", count: seatCount },
    { id: "registration", name: "Registration", count: registrationCount },
    { id: "registrationSeat", name: "RegistrationSeat", count: registrationSeatCount },
  ];

  if (!tableParam) {
    return NextResponse.json({ tables });
  }
  if (!isTable(tableParam)) {
    return NextResponse.json({ error: "Unknown table" }, { status: 400 });
  }

  if (tableParam === "seat") {
    const where: Prisma.SeatWhereInput = q
      ? {
          OR: [
            { id: { contains: q } },
            { row: { contains: q } },
            { section: { contains: q } },
            { block: { contains: q } },
            { status: { contains: q } },
            { type: { contains: q } },
            Number.isFinite(Number(q)) ? { number: Number(q) } : undefined,
          ].filter(Boolean) as Prisma.SeatWhereInput[],
        }
      : {};
    const [total, rows] = await Promise.all([
      prisma.seat.count({ where }),
      prisma.seat.findMany({
        where,
        orderBy: [{ section: "asc" }, { y: "asc" }, { x: "asc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);
    return NextResponse.json({
      tables,
      table: tableParam,
      total,
      page,
      pageSize: PAGE_SIZE,
      rows: rows.map((row) => ({
        ...row,
        holdUntil: row.holdUntil?.toISOString() ?? null,
      })),
    });
  }

  if (tableParam === "registration") {
    const where: Prisma.RegistrationWhereInput = q
      ? {
          OR: [
            { id: { contains: q } },
            { name: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : {};
    const [total, rows] = await Promise.all([
      prisma.registration.count({ where }),
      prisma.registration.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { seats: { include: { seat: true } } },
      }),
    ]);
    return NextResponse.json({
      tables,
      table: tableParam,
      total,
      page,
      pageSize: PAGE_SIZE,
      rows: rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        ticketDelivered: row.ticketDelivered,
        createdAt: row.createdAt.toISOString(),
        seatIds: row.seats.map((s) => s.seatId),
        seatLabels: row.seats.map((s) => `${s.seat.section} ${s.seat.row}-${s.seat.number}`),
      })),
    });
  }

  const where: Prisma.RegistrationSeatWhereInput = q
    ? {
        OR: [{ registrationId: { contains: q } }, { seatId: { contains: q } }],
      }
    : {};
  const [total, rows] = await Promise.all([
    prisma.registrationSeat.count({ where }),
    prisma.registrationSeat.findMany({
      where,
      orderBy: { registrationId: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return NextResponse.json({
    tables,
    table: tableParam,
    total,
    page,
    pageSize: PAGE_SIZE,
    rows,
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const table = String(body?.table ?? "");
  const id = String(body?.id ?? "");
  const data = body?.data && typeof body.data === "object" ? body.data : null;
  if (!isTable(table) || !id || !data) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    if (table === "seat") {
      const patch: Prisma.SeatUpdateInput = {};
      if (typeof data.status === "string") patch.status = data.status;
      if (typeof data.type === "string") patch.type = data.type;
      if (typeof data.block === "string") patch.block = data.block;
      if (typeof data.row === "string") patch.row = data.row;
      if (typeof data.section === "string") patch.section = data.section;
      if (data.price !== undefined) patch.price = Number(data.price);
      if (data.number !== undefined) patch.number = Number(data.number);
      const updated = await prisma.$transaction(async (tx) => {
        const seat = await tx.seat.update({ where: { id }, data: patch });
        if (data.status === "available") {
          await tx.registrationSeat.deleteMany({ where: { seatId: id } });
        }
        return seat;
      });
      return NextResponse.json({
        ...updated,
        holdUntil: updated.holdUntil?.toISOString() ?? null,
      });
    }

    if (table === "registration") {
      const patch: Prisma.RegistrationUpdateInput = {};
      if (typeof data.name === "string") patch.name = data.name;
      if (typeof data.email === "string") patch.email = data.email;
      if (typeof data.phone === "string") patch.phone = data.phone;
      if (typeof data.ticketDelivered === "boolean") patch.ticketDelivered = data.ticketDelivered;
      const updated = await prisma.registration.update({ where: { id }, data: patch });
      return NextResponse.json({
        ...updated,
        createdAt: updated.createdAt.toISOString(),
      });
    }

    return NextResponse.json({ error: "RegistrationSeat rows cannot be patched. Delete and recreate." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const table = String(body?.table ?? req.nextUrl.searchParams.get("table") ?? "");
  const id = String(body?.id ?? req.nextUrl.searchParams.get("id") ?? "");
  const seatId = String(body?.seatId ?? req.nextUrl.searchParams.get("seatId") ?? "");
  if (!isTable(table)) {
    return NextResponse.json({ error: "Unknown table" }, { status: 400 });
  }

  try {
    if (table === "registration") {
      if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
      await prisma.$transaction(async (tx) => {
        const links = await tx.registrationSeat.findMany({ where: { registrationId: id } });
        await tx.registration.delete({ where: { id } });
        if (links.length) {
          await tx.seat.updateMany({
            where: { id: { in: links.map((l) => l.seatId) } },
            data: { status: "available", holdUntil: null },
          });
        }
      });
      return NextResponse.json({ ok: true });
    }

    if (table === "registrationSeat") {
      const registrationId = id;
      if (!registrationId || !seatId) {
        return NextResponse.json({ error: "Missing registrationId or seatId" }, { status: 400 });
      }
      await prisma.$transaction(async (tx) => {
        await tx.registrationSeat.delete({
          where: { registrationId_seatId: { registrationId, seatId } },
        });
        await tx.seat.update({
          where: { id: seatId },
          data: { status: "available", holdUntil: null },
        });
      });
      return NextResponse.json({ ok: true });
    }

    if (table === "seat") {
      return NextResponse.json({ error: "Seats cannot be deleted. Set status to available or blocked." }, { status: 400 });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
