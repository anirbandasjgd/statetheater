import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const ok = await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const seatId = String(body?.seatId ?? "");
  if (!seatId) {
    return NextResponse.json({ error: "Missing seatId" }, { status: 400 });
  }
  const seat = await prisma.seat.findUnique({ where: { id: seatId } });
  if (!seat) {
    return NextResponse.json({ error: "Seat not found" }, { status: 404 });
  }
  if (seat.status === "sold") {
    return NextResponse.json({ error: "Sold seats cannot be blocked." }, { status: 409 });
  }
  const next = seat.status === "blocked" ? "available" : "blocked";
  await prisma.seat.update({ where: { id: seatId }, data: { status: next } });
  return NextResponse.json({ id: seatId, status: next });
}
