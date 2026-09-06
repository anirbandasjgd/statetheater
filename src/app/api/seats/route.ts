import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const section = req.nextUrl.searchParams.get("section") ?? "orchestra";
  const admin = Boolean(await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value));
  const seats = await prisma.seat.findMany({
    where: { section },
    orderBy: [{ y: "asc" }, { x: "asc" }],
    include: {
      registrations: {
        include: { registration: { select: { id: true, name: true, ticketDelivered: true } } },
      },
    },
  });
  return NextResponse.json({
    admin,
    seats: seats.map((s) => {
      const holder = admin ? s.registrations[0]?.registration : null;
      return {
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
        ...(admin
          ? {
              holderName: holder?.name ?? null,
              registrationId: holder?.id ?? null,
              ticketDelivered: holder?.ticketDelivered ?? false,
            }
          : {}),
      };
    }),
  });
}
