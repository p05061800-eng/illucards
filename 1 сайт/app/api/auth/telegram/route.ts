import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  profileFromVerifiedWidgetData,
  telegramWidgetParamsFromSearchParams,
} from "@/app/lib/telegramLoginVerify";
import {
  isTelegramCodeAuthConfigured,
  resolveTelegramAuthCodeToUserId,
} from "@/app/lib/telegramAuthCode";
import { telegramUserIdCookieOptions } from "@/app/lib/telegramAuthCookies";
import {
  sealTelegramWidgetProfile,
  TELEGRAM_WIDGET_SESSION_COOKIE,
} from "@/app/lib/telegramWidgetSessionCookie";
import { botVerifyTelegramWidget } from "@/app/lib/telegramBotRenderApi";

function loginRedirect(request: NextRequest, tg: "widget" | "err"): NextResponse {
  const u = new URL("/", request.url);
  u.searchParams.set("tg", tg);
  return NextResponse.redirect(u);
}

function isHttps(request: NextRequest): boolean {
  if (request.nextUrl.protocol === "https:") return true;
  const fwd = request.headers.get("x-forwarded-proto");
  return fwd === "https";
}

function searchParamsToWidgetObject(
  params: URLSearchParams,
): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  params.forEach((value, key) => {
    if (key === "id" || key === "auth_date") {
      const n = Number(value);
      if (Number.isFinite(n)) o[key] = n;
    } else {
      o[key] = value;
    }
  });
  return o;
}

/**
 * GET — редирект с официального Telegram Login Widget (`data-auth-url`).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!params.get("hash")) {
    return loginRedirect(request, "err");
  }

  const widgetData = searchParamsToWidgetObject(params);
  const verified = await botVerifyTelegramWidget(widgetData);
  if (!verified.ok) {
    return loginRedirect(request, "err");
  }

  const data = telegramWidgetParamsFromSearchParams(params);
  const profile = profileFromVerifiedWidgetData(data);
  if (!profile) {
    return loginRedirect(request, "err");
  }

  let sealed: string;
  try {
    sealed = sealTelegramWidgetProfile(profile);
  } catch {
    return loginRedirect(request, "err");
  }

  const res = loginRedirect(request, "widget");
  res.cookies.set({
    name: TELEGRAM_WIDGET_SESSION_COOKIE,
    value: sealed,
    httpOnly: true,
    secure: isHttps(request),
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
  res.cookies.set(telegramUserIdCookieOptions(request, profile.telegramId));
  return res;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Пустое тело запроса." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;

  const hasWidget =
    typeof data.id === "number" &&
    typeof data.hash === "string" &&
    data.hash.length > 0;

  const codeRaw = data.code;
  const trimmedCode =
    typeof codeRaw === "string" ? codeRaw.trim() : "";
  const hasCodeOnly = trimmedCode.length > 0 && !hasWidget;

  if (hasCodeOnly) {
    if (!isTelegramCodeAuthConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Сервер: не настроен вход по коду (TELEGRAM_BOT_API_URL или TELEGRAM_AUTH_CODE_MAP).",
        },
        { status: 503 },
      );
    }
    const uid = await resolveTelegramAuthCodeToUserId(trimmedCode);
    if (uid === null) {
      return NextResponse.json(
        { ok: false, error: "Неверный или устаревший код" },
        { status: 401 },
      );
    }
    const uidFloor = Math.floor(uid);
    const out = NextResponse.json({ ok: true, user_id: uidFloor });
    out.cookies.set(telegramUserIdCookieOptions(request, uidFloor));
    return out;
  }

  const id = data.id;
  if (typeof id !== "number" || !Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Нет корректного id Telegram." }, { status: 400 });
  }

  const verified = await botVerifyTelegramWidget(data);
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: "Подпись Telegram недействительна." }, { status: 401 });
  }

  const profile = profileFromVerifiedWidgetData(data);
  if (!profile) {
    return NextResponse.json({ ok: false, error: "Нет корректного id Telegram." }, { status: 400 });
  }

  const out = NextResponse.json({ ok: true, profile });
  out.cookies.set(telegramUserIdCookieOptions(request, profile.telegramId));
  return out;
}
