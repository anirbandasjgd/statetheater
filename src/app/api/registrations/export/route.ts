import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import { buildAssignedSeatsWorkbook } from "@/lib/export-assigned-seats";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ok = await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const file = await buildAssignedSeatsWorkbook(prisma);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="assigned-seats-${stamp}.xlsx"`,
    },
  });
}
