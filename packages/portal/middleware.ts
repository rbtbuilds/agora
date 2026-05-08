import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Auth.js v5 cookie names — secure prefix when served over HTTPS.
  const sessionToken =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token");

  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    const target = request.nextUrl.pathname + request.nextUrl.search;
    if (target && target !== "/" && target !== "/login") {
      loginUrl.searchParams.set("callbackUrl", target);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
