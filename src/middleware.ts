import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ok = await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);

  if (pathname === "/admin/login") {
    if (ok) {
      const dest = req.nextUrl.clone();
      dest.pathname = "/admin";
      return NextResponse.redirect(dest);
    }
    return NextResponse.next();
  }

  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = req.nextUrl.clone();
  login.pathname = "/admin/login";
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/registrations", "/api/seats/block"],
};
