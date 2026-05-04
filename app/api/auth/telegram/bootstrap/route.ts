import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { COOKIE_TELEGRAM_USER_ID, TELEGRAM_USER_ID_COOKIE_MAX_AGE_SEC } from "@/app/lib/telegramUserIdentity";
import {
  TELEGRAM_WIDGET_SESSION_COOKIE,
  unsealTelegramWidgetProfile,
} from "@/app/lib/telegramWidgetSessionCookie";

function isHttps(request: NextRequest): boolean {
  if (request.nextUrl.protocol === "https:") return true;
  const fwd = request.headers.get("x-forwarded-proto");
  return fwd === "https";
}

/**
 * Одноразово читает cookie после GET /api/auth/telegram (виджет),
 * отдаёт профиль клиенту для записи в localStorage (AuthContext).
 */
export async function GET(request: NextRequest) {
  const raw = request.cookies.get(TELEGRAM_WIDGET_SESSION_COOKIE)?.value;
  const profile = unsealTelegramWidgetProfile(raw);

  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "Сессия не найдена или устарела." },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true, profile });
  res.cookies.set({
    name: TELEGRAM_WIDGET_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  res.cookies.set({
    name: COOKIE_TELEGRAM_USER_ID,
    value: String(Math.floor(profile.telegramId)),
    httpOnly: true,
    secure: isHttps(request),
    sameSite: "lax",
    path: "/",
    maxAge: TELEGRAM_USER_ID_COOKIE_MAX_AGE_SEC,
  });
  return res;
}
