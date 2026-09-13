import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAdmin = nextUrl.pathname.startsWith("/admin");
      const isOnLogin = nextUrl.pathname === "/login";

      if (isOnAdmin) {
        if (!isLoggedIn) return false;
        if ((auth?.user as { role?: string } | undefined)?.role !== "ADMIN") {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      if (isOnLogin && isLoggedIn) {
        return Response.redirect(new URL("/admin/dashboard", nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session?.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string | undefined;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
