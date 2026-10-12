import { NextRequest ,NextResponse} from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/auth";

export async function proxy(req: NextRequest) {
  const user = await verifySession(req.cookies.get(SESSION_COOKIE)?.value)
  const {pathname}= req.nextUrl

  if (pathname === "/auth/login") {
    return user ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }

  if (user) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/auth/login", req.url));
}

export const config = {
  matcher: ["/((?!api/login|_next/static|_next/image|favicon.ico|ku_logo.svg).*)"],
};
