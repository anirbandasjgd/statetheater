import { NextResponse } from "next/server";
import { ADMIN_COOKIE, createSessionToken, credentialsMatch, sessionCookieOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");

  if (!credentialsMatch(username, password)) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await createSessionToken(), sessionCookieOptions());
  return res;
}
