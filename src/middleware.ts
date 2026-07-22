import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdminSessionEdge, ADMIN_COOKIE_EDGE } from "@/lib/admin-auth-edge";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginApi = pathname === "/api/admin/login";
  const isSessionApi = pathname === "/api/admin/session";
  const token = request.cookies.get(ADMIN_COOKIE_EDGE)?.value;
  const isAuthenticated = await verifyAdminSessionEdge(token);

  if (isLoginApi || isSessionApi) {
    return NextResponse.next();
  }

  if (pathname === "/admin/login") {
    const destination = isAuthenticated ? "/admin" : "/";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (!isAuthenticated) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const response = NextResponse.redirect(new URL("/", request.url));
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
