import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  TELEGRAM_WIDGET_SESSION_COOKIE,
  unsealTelegramWidgetProfile,
} from "@/app/lib/telegramWidgetSessionCookie";

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
  return res;
}
