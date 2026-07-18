import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

type Role = "ADMIN" | "PROVIDER" | "RECEPTIONIST" | "PATIENT";

const roleRoutes: Record<string, Role[]> = {
  "/dashboard/calendar": ["ADMIN", "PROVIDER", "RECEPTIONIST"],
  "/dashboard/admin": ["ADMIN"],
  "/dashboard/appointments": ["ADMIN", "PROVIDER", "RECEPTIONIST", "PATIENT"],
  "/dashboard/patients": ["ADMIN", "PROVIDER", "RECEPTIONIST"],
  "/dashboard/providers": ["ADMIN"],
  "/dashboard/schedule": ["ADMIN", "PROVIDER"],
  "/dashboard/settings": ["ADMIN", "PROVIDER", "RECEPTIONIST"],
  "/dashboard": ["ADMIN", "PROVIDER", "RECEPTIONIST", "PATIENT"],
};

function hasAccess(pathname: string, role: Role): boolean {
  const matched = Object.entries(roleRoutes)
    .filter(([route]) => pathname.startsWith(route))
    .sort(([a], [b]) => b.length - a.length)[0];
  if (!matched) return true;
  return matched[1].includes(role);
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  const publicPaths = ["/login", "/register", "/api"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  if (!isLoggedIn && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (isLoggedIn && req.auth?.user) {
    const role = req.auth.user.role as Role;
    if (!hasAccess(pathname, role)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
