import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /[0-9].*[0-9].*[0-9].*[0-9].*[0-9].*[0-9].*[0-9]/;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const seatIds = Array.isArray(body.seatIds) ? body.seatIds.map(String) : [];

  if (name.length < 2) {
    return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
  }
  if (!EMAIL.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!PHONE.test(phone)) {
    return NextResponse.json({ error: "Please enter a valid phone number." }, { status: 400 });
  }
  if (seatIds.length === 0) {
    return NextResponse.json({ error: "Select at least one seat." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const seats = await tx.seat.findMany({
        where: { id: { in: seatIds } },
      });
      if (seats.length !== seatIds.length) {
        throw new Error("One or more seats could not be found.");
      }
      const taken = seats.filter((s) => s.status === "sold" || s.status === "blocked");
      if (taken.length) {
        throw new Error(
          `These seats are no longer available: ${taken
            .map((s) => `${s.row}-${s.number}`)
            .join(", ")}`,
        );
      }

      const registration = await tx.registration.create({
        data: {
          name,
          email,
          phone,
          seats: {
            create: seatIds.map((seatId: string) => ({ seatId })),
          },
        },
        include: { seats: { include: { seat: true } } },
      });

      await tx.seat.updateMany({
        where: { id: { in: seatIds } },
        data: { status: "sold", holdUntil: null },
      });

      return registration;
    });

    return NextResponse.json({
      id: result.id,
      name: result.name,
      email: result.email,
      phone: result.phone,
      seats: result.seats.map((rs) => ({
        id: rs.seat.id,
        section: rs.seat.section,
        block: rs.seat.block,
        row: rs.seat.row,
        number: rs.seat.number,
        price: rs.seat.price,
      })),
      total: result.seats.reduce((sum, rs) => sum + rs.seat.price, 0),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not complete registration.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
