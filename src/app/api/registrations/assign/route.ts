import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import { applyAssignFromExcel, previewAssignFromExcel } from "@/lib/assign-from-excel";

export const runtime = "nodejs";

async function requireAdmin(req: NextRequest) {
  return verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const file = await readFile(resolve(process.cwd(), "data/attendees-template.xlsx"));
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="attendees-template.xlsx"',
    },
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Upload an Excel file." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose an Excel file with names and tiers." }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "That file is too large (8 MB max)." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const apply = String(form.get("apply") ?? "") === "true";

  try {
    const result = apply ? await applyAssignFromExcel(prisma, buffer) : await previewAssignFromExcel(prisma, buffer);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read that Excel file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
