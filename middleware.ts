// middleware.ts
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname, origin } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if ((req.auth?.user as { role?: string } | undefined)?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", origin));
    }
  }

  if (pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/admin/dashboard", origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/login"],
};