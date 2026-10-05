import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  isAdminLoginPath,
  isAdminMutatingApi,
  isAdminPagePath,
  unsealAdminSessionEdge,
} from "@/app/lib/adminSessionEdge";

function applyApiCors(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get("origin");
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  } else {
    response.headers.set("Access-Control-Allow-Origin", "*");
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

export async function proxy(request: NextRequest) {
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

  if (isAdminMutatingApi(pathname, request.method) && !adminSession) {
    return NextResponse.json(
      { error: "Нужна авторизация администратора" },
      { status: 401 },
    );
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
  matcher: ["/api/:path*", "/login", "/admin", "/admin/:path*"],
};
