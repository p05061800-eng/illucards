import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  isAdminLoginPath,
  isAdminPagePath,
  unsealAdminSessionEdge,
} from "@/app/lib/adminSessionEdge";

function applyApiCors(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get("origin");
  const allowed =
    origin === "https://illucards.by" ||
    origin === "https://www.illucards.by" ||
    origin === "http://localhost:3010" ||
    origin === "http://127.0.0.1:3010";
  if (origin && allowed) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Vary", "Origin");
  }
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  return response;
}

function canonicalWwwHost(request: NextRequest): string | null {
  const raw =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const host = raw?.split(",")[0]?.split(":")[0]?.trim().toLowerCase() ?? "";
  if (host === "illucards.by") return "www.illucards.by";
  return null;
}

export async function proxy(request: NextRequest) {
  const wwwHost = canonicalWwwHost(request);
  if (wwwHost) {
    const dest = request.nextUrl.clone();
    dest.hostname = wwwHost;
    dest.protocol = "https:";
    dest.port = "";
    return NextResponse.redirect(dest, 308);
  }

  const { pathname } = request.nextUrl;
  const adminSession = await unsealAdminSessionEdge(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );

  if (isAdminPagePath(pathname)) {
    if (isAdminLoginPath(pathname)) {
      if (adminSession) {
        const dest = request.nextUrl.clone();
        dest.pathname = "/admin";
        dest.search = "";
        return NextResponse.redirect(dest);
      }
      return NextResponse.next();
    }
    if (!adminSession) {
      const dest = request.nextUrl.clone();
      dest.pathname = "/admin/login";
      dest.search = "";
      if (pathname !== "/admin") {
        dest.searchParams.set("next", pathname);
      }
      return NextResponse.redirect(dest);
    }
    return NextResponse.next();
  }

  if (pathname === "/login") {
    const dest = request.nextUrl.clone();
    dest.pathname = "/";
    dest.search = "";
    const userId =
      request.nextUrl.searchParams.get("user_id") ||
      request.nextUrl.searchParams.get("user");
    const username = request.nextUrl.searchParams.get("username");
    if (userId != null && userId !== "") {
      dest.searchParams.set("user_id", userId);
    }
    if (username != null && username !== "") {
      dest.searchParams.set("username", username);
    }
    return NextResponse.redirect(dest);
  }

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (request.method === "OPTIONS") {
    return applyApiCors(request, new NextResponse(null, { status: 204 }));
  }
  return applyApiCors(request, NextResponse.next());
}

export const config = {
  matcher: [
    "/",
    "/api/:path*",
    "/login",
    "/admin",
    "/admin/:path*",
  ],
};
