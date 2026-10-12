import { NextRequest } from "next/server";
import { SESSION_COOKIE, logEvent, redirectTo, verifySession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (user) await logEvent("logout", user, req);

  const res = redirectTo(req, "/auth/login");
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
