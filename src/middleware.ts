import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const maintenanceMode = process.env.MAINTENANCE_MODE === "true";
  const { pathname } = request.nextUrl;

  if (maintenanceMode) {
    // Exclude API routes, /maintenance itself, and system assets
    const isExcluded =
      pathname.startsWith("/maintenance") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/static") ||
      pathname.includes(".") ||
      pathname === "/favicon.ico";

    if (!isExcluded) {
      const url = request.nextUrl.clone();
      url.pathname = "/maintenance";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
