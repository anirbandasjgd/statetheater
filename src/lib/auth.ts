export const ADMIN_COOKIE = "stnj_admin";

const ADMIN_USER = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD ?? "admin";
const SECRET = process.env.ADMIN_SESSION_SECRET ?? "stnj-dev-admin-session";
const SESSION_MS = 12 * 60 * 60 * 1000;

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function toB64Url(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const byte of bytes) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmac(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toB64Url(sig);
}

export function credentialsMatch(username: string, password: string) {
  return safeEqual(username, ADMIN_USER) && safeEqual(password, ADMIN_PASS);
}

export async function createSessionToken() {
  const exp = Date.now() + SESSION_MS;
  const payload = `admin.${exp}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0) return false;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const [user, exp] = payload.split(".");
  if (user !== "admin" || !exp) return false;
  if (Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(payload));
}

export function sessionCookieOptions(maxAge = SESSION_MS / 1000) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  };
}
