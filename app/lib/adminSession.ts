import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  isHttpsRequest,
  rootCookieDomainFromRequest,
} from "@/app/lib/telegramAuthCookies";
import { ADMIN_SESSION_COOKIE } from "@/app/lib/adminSessionEdge";

export { ADMIN_SESSION_COOKIE };
export const ADMIN_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 14;

export type AdminSession = {
  login: string;
  exp: number;
};

function adminSigningSecret(): string {
  const dedicated = process.env.ADMIN_SESSION_SECRET?.trim();
  if (dedicated) return dedicated;
  const fallback =
    process.env.TELEGRAM_WIDGET_COOKIE_SECRET?.trim() ||
    process.env.ILLUCARDS_ORDER_UPDATE_SECRET?.trim() ||
    process.env.ADMIN_PASSWORD?.trim() ||
    "";
  return fallback;
}

export function getAdminCredentials(): { login: string; password: string } | null {
  const login = process.env.ADMIN_LOGIN?.trim() ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!login || !password) return null;
  return { login, password };
}

export function timingSafeEqualUtf8(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) {
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

export function credentialsMatch(login: string, password: string): boolean {
  const expected = getAdminCredentials();
  if (!expected) return false;
  const loginOk = timingSafeEqualUtf8(login, expected.login);
  const passOk = timingSafeEqualUtf8(password, expected.password);
  return loginOk && passOk;
}

export function sealAdminSession(login: string): string {
  const secret = adminSigningSecret();
  if (!secret) {
    throw new Error("Не задан ADMIN_SESSION_SECRET (или ADMIN_PASSWORD)");
  }
  const payload: AdminSession = {
    login,
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SEC,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function unsealAdminSession(cookieValue: string | undefined): AdminSession | null {
  if (!cookieValue || typeof cookieValue !== "string") return null;
  const secret = adminSigningSecret();
  if (!secret) return null;
  const dot = cookieValue.indexOf(".");
  if (dot < 1) return null;
  const body = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Record<string, unknown>;
    const login = typeof p.login === "string" ? p.login.trim() : "";
    const exp = typeof p.exp === "number" ? p.exp : Number(p.exp);
    if (!login || !Number.isFinite(exp)) return null;
    if (exp < Math.floor(Date.now() / 1000)) return null;
    return { login, exp };
  } catch {
    return null;
  }
}

export function readAdminSessionFromRequest(request: NextRequest): AdminSession | null {
  return unsealAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

export function adminUnauthorizedJson(): NextResponse {
  return NextResponse.json(
    { error: "Нужна авторизация администратора" },
    { status: 401 },
  );
}

export function rejectUnlessAdmin(request: NextRequest): NextResponse | null {
  if (readAdminSessionFromRequest(request)) return null;
  return adminUnauthorizedJson();
}

export function adminSessionCookieOptions(
  request: NextRequest,
  value: string,
  maxAge: number,
): {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
  domain?: string;
} {
  const domain = rootCookieDomainFromRequest(request);
  return {
    name: ADMIN_SESSION_COOKIE,
    value,
    httpOnly: true,
    secure: isHttpsRequest(request),
    sameSite: "lax",
    path: "/",
    maxAge,
    ...(domain ? { domain } : {}),
  };
}
