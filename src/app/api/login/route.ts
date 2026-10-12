import { NextRequest } from "next/server";
import {
  SESSION_COOKIE, clearFailures, createSession, getIp, isBlocked,
  redirectTo,
  logEvent, recordFailure, verifyCreentials,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const ip = getIp(req);

  const back = (error: string) =>
    redirectTo(req, `/auth/login?error=${error}`);

  if (isBlocked(ip)) {
    await logEvent("login_blocked", username, req);
    return back("locked");
  }

  if (!verifyCreentials(username, password)) {
    recordFailure(ip);
    await logEvent("login_failed", username, req);
    return back("invalid");
  }

  clearFailures(ip);
  await logEvent("login_success", username, req);

  const res = redirectTo(req, "/");
  res.cookies.set(SESSION_COOKIE, await createSession(username), {
    httpOnly: true,
    // Secure เฉพาะเมื่อเข้าผ่าน HTTPS ไม่งั้นเบราว์เซอร์ทิ้ง cookie แล้ว login วนไม่จบ
    secure: req.headers.get("x-forwarded-proto") === "https",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 3600,
  });

  return res;
}
