import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isValidLoginWaitId } from "@/app/lib/telegramLoginWaitKeys";
import { consumeLoginWait } from "@/app/lib/telegramLoginWaitStore";
import {
  COOKIE_TELEGRAM_USER_ID,
  TELEGRAM_USER_ID_COOKIE_MAX_AGE_SEC,
} from "@/app/lib/telegramUserIdentity";

function isHttps(request: NextRequest): boolean {
  if (request.nextUrl.protocol === "https:") return true;
  const fwd = request.headers.get("x-forwarded-proto");
  return fwd === "https";
}

/** Завершить вход по wait_id после подтверждения в боте — без ввода кода. */
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

  const waitRaw = (body as Record<string, unknown>).wait_id;
  const waitId = typeof waitRaw === "string" ? waitRaw.trim().toLowerCase() : "";
  if (!isValidLoginWaitId(waitId)) {
    return NextResponse.json({ error: "Некорректный wait_id" }, { status: 400 });
  }

  const profile = await consumeLoginWait(waitId);
  if (!profile) {
    return NextResponse.json(
      { error: "Сессия входа не найдена или устарела. Запросите вход снова." },
      { status: 401 },
    );
  }

  const res = NextResponse.json({
    ok: true,
    user_id: profile.user_id,
    username: profile.username ?? null,
  });
  res.cookies.set({
    name: COOKIE_TELEGRAM_USER_ID,
    value: String(profile.user_id),
    httpOnly: true,
    secure: isHttps(request),
    sameSite: "lax",
    path: "/",
    maxAge: TELEGRAM_USER_ID_COOKIE_MAX_AGE_SEC,
  });
  return res;
}
