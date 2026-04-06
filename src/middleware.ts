import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "ps_auth";

const getSecret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET ?? "fallback-dev-secret-please-change-in-production"
  );

// Pages accessible without auth
const PUBLIC_PAGES = new Set(["/login", "/request-access", "/setup"]);
// API prefixes accessible without auth
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/request-access", "/api/admin/setup"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public pages & API prefixes
  if (
    PUBLIC_PAGES.has(pathname) ||
    PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const role = payload.role as string;
    const manufacturerId = payload.manufacturerId as number | null;

    // Block non-admins from /admin
    if (pathname.startsWith("/admin") && role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Non-admin API guard: filter manufacturer/project access at API level
    if (pathname.startsWith("/api/") && role !== "admin") {
      // Block accessing a different manufacturer's data
      const mMatch = pathname.match(/^\/api\/manufacturers\/(\d+)/);
      if (mMatch && manufacturerId !== null) {
        const urlMfgId = parseInt(mMatch[1]);
        if (urlMfgId !== manufacturerId) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    // Non-admin with a manufacturer → send directly to their sheet
    if (pathname === "/" && role !== "admin" && manufacturerId) {
      return NextResponse.redirect(
        new URL(`/manufacturer/${manufacturerId}`, request.url)
      );
    }
    // Non-admin without a manufacturer → let them reach the dashboard to create one

    // Non-admin visiting a different manufacturer's page → redirect to own
    if (
      pathname.startsWith("/manufacturer/") &&
      role !== "admin" &&
      manufacturerId !== null
    ) {
      const urlId = parseInt(pathname.split("/")[2]);
      if (urlId !== manufacturerId) {
        return NextResponse.redirect(
          new URL(`/manufacturer/${manufacturerId}`, request.url)
        );
      }
    }

    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
