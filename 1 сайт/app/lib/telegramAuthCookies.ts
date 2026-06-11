import type { NextRequest } from "next/server";
import {
  COOKIE_TELEGRAM_USER_ID,
  TELEGRAM_USER_ID_COOKIE_MAX_AGE_SEC,
} from "@/app/lib/telegramUserIdentity";

export function isHttpsRequest(request: NextRequest): boolean {
  if (request.nextUrl.protocol === "https:") return true;
  const fwd = request.headers.get("x-forwarded-proto");
  return fwd === "https";
}

/** Общий домен cookie для illucards.by и www.illucards.by */
export function rootCookieDomainFromHost(host: string | null | undefined): string | undefined {
  if (!host) return undefined;
  const h = host.split(":")[0]?.trim().toLowerCase() ?? "";
  if (h === "illucards.by" || h === "www.illucards.by") return ".illucards.by";
  return undefined;
}

export function rootCookieDomainFromRequest(request: NextRequest): string | undefined {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return rootCookieDomainFromHost(host);
}

export function telegramUserIdCookieOptions(
  request: NextRequest,
  userId: number,
): {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
} {
  return {
    name: COOKIE_TELEGRAM_USER_ID,
    value: String(Math.floor(userId)),
    httpOnly: true,
    secure: isHttpsRequest(request),
    sameSite: "lax",
    path: "/",
    maxAge: TELEGRAM_USER_ID_COOKIE_MAX_AGE_SEC,
  };
}

export function clearTelegramUserIdCookieOptions(request: NextRequest): {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: 0;
} {
  return {
    name: COOKIE_TELEGRAM_USER_ID,
    value: "",
    httpOnly: true,
    secure: isHttpsRequest(request),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}
