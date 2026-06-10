import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { clearTelegramUserIdCookieOptions } from "@/app/lib/telegramAuthCookies";

/** Сбрасывает HttpOnly cookie `telegram_user_id` (его нельзя удалить из JS). */
export async function POST(request: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearTelegramUserIdCookieOptions(request));
  return res;
}
