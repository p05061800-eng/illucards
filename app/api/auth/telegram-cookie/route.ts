import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  COOKIE_TELEGRAM_USER_ID,
  TELEGRAM_USER_ID_COOKIE_MAX_AGE_SEC,
} from "@/app/lib/telegramUserIdentity";

function isHttps(request: NextRequest): boolean {
  if (request.nextUrl.protocol === "https:") return true;
  const fwd = request.headers.get("x-forwarded-proto");
  return fwd === "https";
}

function parseUserId(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 1e12) return null;
  return Math.floor(n);
}

/**
 * POST /api/auth/telegram-cookie — ставит HttpOnly `telegram_user_id` после входа по коду,
 * когда верификация шла на внешний URL (Set-Cookie с того домена на illucards не попадёт).
 * Разрешён только same-origin / same-site fetch (Sec-Fetch-Site).
 */
export async function POST(request: NextRequest) {
  const site = request.headers.get("sec-fetch-site");
  if (site != null && site !== "same-origin" && site !== "same-site") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ожидается объект" }, { status: 400 });
  }
  const userId = parseUserId((body as Record<string, unknown>).user_id);
  if (userId == null) {
    return NextResponse.json({ error: "Некорректный user_id" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_TELEGRAM_USER_ID,
    value: String(userId),
    httpOnly: true,
    secure: isHttps(request),
    sameSite: "lax",
    path: "/",
    maxAge: TELEGRAM_USER_ID_COOKIE_MAX_AGE_SEC,
  });
  return res;
}
