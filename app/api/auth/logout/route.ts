import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { COOKIE_TELEGRAM_USER_ID } from "@/app/lib/telegramUserIdentity";

function isHttps(request: NextRequest): boolean {
  if (request.nextUrl.protocol === "https:") return true;
  const fwd = request.headers.get("x-forwarded-proto");
  return fwd === "https";
}

/** Сбрасывает HttpOnly cookie `telegram_user_id` (его нельзя удалить из JS). */
export async function POST(request: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_TELEGRAM_USER_ID,
    value: "",
    httpOnly: true,
    secure: isHttps(request),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
