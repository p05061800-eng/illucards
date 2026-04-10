import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  return response;
}

export function middleware(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return applyApiCors(request, new NextResponse(null, { status: 204 }));
  }
  return applyApiCors(request, NextResponse.next());
}

export const config = {
  matcher: "/api/:path*",
};
