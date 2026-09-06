import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import { sameSeatBand, tierFor } from "@/lib/pricing";

export async function POST(req: NextRequest) {
  const ok = await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const fromSeatId = typeof body?.fromSeatId === "string" ? body.fromSeatId : "";
  const rawIds: unknown[] = Array.isArray(body?.newSeatIds) ? body.newSeatIds : [];
  const newSeatIds = [
    ...new Set(rawIds.filter((id): id is string => typeof id === "string" && id.length > 0)),
  ];
  if (!fromSeatId || newSeatIds.length === 0) {
    return NextResponse.json({ error: "Provide the current seat and the replacement seats." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const from = await tx.seat.findUnique({
        where: { id: fromSeatId },
        include: { registrations: { include: { registration: { include: { seats: { include: { seat: true } } } } } } },
      });
      const registration = from?.registrations[0]?.registration;
      if (!from || !registration) {
        throw Object.assign(new Error("That seat is not assigned to a guest."), { status: 404 });
      }
      if (registration.ticketDelivered) {
        throw Object.assign(new Error("Ticket already issued"), { status: 409 });
      }

      const source = registration.seats
        .map((link) => link.seat)
        .filter((seat) => sameSeatBand(seat, from));
      if (source.length === 0) {
        throw Object.assign(new Error("No seats to move in that tier."), { status: 400 });
      }
      if (newSeatIds.length !== source.length) {
        throw Object.assign(
          new Error(`Pick ${source.length} ${tierFor(from.section, from.row, from.block)} seat${source.length === 1 ? "" : "s"}.`),
          { status: 400 },
        );
      }

      const sourceIds = new Set(source.map((seat) => seat.id));
      if (newSeatIds.some((id) => sourceIds.has(id))) {
        throw Object.assign(new Error("Replacement seats must be different from the current seats."), { status: 400 });
      }

      const nextSeats = await tx.seat.findMany({ where: { id: { in: newSeatIds } } });
      if (nextSeats.length !== newSeatIds.length) {
        throw Object.assign(new Error("One of those seats was not found."), { status: 404 });
      }
      for (const seat of nextSeats) {
        if (seat.status !== "available" || seat.type === "hold") {
          throw Object.assign(new Error(`${seat.row}-${seat.number} is no longer available.`), { status: 409 });
        }
        if (!sameSeatBand(seat, from)) {
          throw Object.assign(
            new Error("Replacement seats must be in the same section and tier."),
            { status: 400 },
          );
        }
      }

      await tx.registrationSeat.deleteMany({
        where: { registrationId: registration.id, seatId: { in: [...sourceIds] } },
      });
      await tx.seat.updateMany({
        where: { id: { in: [...sourceIds] } },
        data: { status: "available", holdUntil: null },
      });
      await tx.registrationSeat.createMany({
        data: newSeatIds.map((seatId) => ({ registrationId: registration.id, seatId })),
      });
      await tx.seat.updateMany({
        where: { id: { in: newSeatIds } },
        data: { status: "sold", holdUntil: null },
      });

      return {
        registrationId: registration.id,
        name: registration.name,
        moved: source.length,
        tier: tierFor(from.section, from.row, from.block),
      };
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not move those seats.";
    const status = typeof err === "object" && err && "status" in err ? Number(err.status) : 400;
    return NextResponse.json({ error: message }, { status: Number.isFinite(status) ? status : 400 });
  }
}
