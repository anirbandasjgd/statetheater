import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const section = req.nextUrl.searchParams.get("section") ?? "orchestra";
  const seats = await prisma.seat.findMany({
    where: { section },
    orderBy: [{ y: "asc" }, { x: "asc" }],
  });
  return NextResponse.json(
    seats.map((s) => ({
      id: s.id,
      section: s.section,
      block: s.block,
      row: s.row,
      number: s.number,
      type: s.type,
      price: s.price,
      x: s.x,
      y: s.y,
      status: s.status === "held" && s.holdUntil && s.holdUntil < new Date() ? "available" : s.status,
    })),
  );
}
