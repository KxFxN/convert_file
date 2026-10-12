import { scryptSync, timingSafeEqual } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose"

type User = { u: string; s: string; h: string; }

export const SESSION_COOKIE = "session";

const users = (): User[] =>
  JSON.parse((process.env.AUTH_USERS ?? "[]").replace(/^'|'$/g, ""))
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET);

export function verifyCreentials(username: string, password: string) {
  const user = users().find((x) => x.u === username)
  const expected = Buffer.from(user?.h ?? "00".repeat(64), "hex");
  const actual = scryptSync(password, Buffer.from(user?.s ?? "00", "hex"), expected.length)
  return !!user && timingSafeEqual(actual , expected)
}

export const createSession = (username: string) =>
  new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret())

export async function verifySession(token?: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

const LOG_FILE =
  process.env.LOGIN_LOG_PATH ?? path.join(process.cwd(), "data", "login-log.csv");

const csvCell = (v: string) => {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function logEvent(
  event: "login_success" | "login_failed" | "login_blocked" | "logout",
  username: string,
  req: Request
) {
  try {
    await mkdir(path.dirname(LOG_FILE), { recursive: true });
    const row = [
      new Date().toISOString(),
      event,
      username.slice(0, 64),
      getIp(req),
      (req.headers.get("user-agent") ?? "").slice(0, 200),
    ]
      .map(csvCell)
      .join(",");
    await appendFile(LOG_FILE, row + "\n", "utf8");
  } catch (e) {
    console.error("login log write failed", e);
  }
}

export const getIp = (req: Request) =>
  req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

const WINDOW_MS = 15 * 60_000;
const MAX_FAILS = 5;
const fails = new Map<string, { count: number; first: number }>();

export function isBlocked(ip: string) {
  const f = fails.get(ip);
  if (!f) return false;
  if (Date.now() - f.first > WINDOW_MS) {
    fails.delete(ip);
    return false;
  }
  return f.count >= MAX_FAILS;
}
export function recordFailure(ip: string) {
  const f = fails.get(ip);
  if (!f || Date.now() - f.first > WINDOW_MS) fails.set(ip, { count: 1, first: Date.now() });
  else f.count++;
}
export const clearFailures = (ip: string) => fails.delete(ip);

export function redirectTo(req: Request, pathAndQuery: string) {
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("host") ?? new URL(req.url).host;
  return NextResponse.redirect(`${proto}://${host}${pathAndQuery}`, 303);
}
