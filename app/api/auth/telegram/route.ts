import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  profileFromVerifiedWidgetData,
  telegramWidgetParamsFromSearchParams,
  verifyTelegramWidgetFromSearchParams,
  verifyTelegramWidgetHash,
} from "@/app/lib/telegramLoginVerify";
import {
  isTelegramCodeAuthConfigured,
  resolveTelegramAuthCodeToUserId,
} from "@/app/lib/telegramAuthCode";
import {
  sealTelegramWidgetProfile,
  TELEGRAM_WIDGET_SESSION_COOKIE,
} from "@/app/lib/telegramWidgetSessionCookie";

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

/**
 * GET — редирект с официального Telegram Login Widget (`data-auth-url`).
 * Query: id, first_name, username?, auth_date, hash, …
 */
export async function GET(request: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return loginRedirect(request, "err");
  }

  const params = request.nextUrl.searchParams;
  if (!params.get("hash")) {
    return loginRedirect(request, "err");
  }

  if (!verifyTelegramWidgetFromSearchParams(token, params)) {
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
  return res;
}

export async function POST(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

  let body: unknown;
  try {
    body = await req.json();
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
            "Сервер: не настроен вход по коду (TELEGRAM_AUTH_CODE_MAP или TELEGRAM_AUTH_CODE_VERIFY_URL).",
        },
        { status: 503 }
      );
    }
    const uid = await resolveTelegramAuthCodeToUserId(trimmedCode, token);
    if (uid === null) {
      return NextResponse.json(
        { ok: false, error: "Неверный или устаревший код" },
        { status: 401 }
      );
    }
    return NextResponse.json({ ok: true, user_id: uid });
  }

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Сервер: не задан TELEGRAM_BOT_TOKEN." },
      { status: 503 }
    );
  }

  const id = data.id;
  if (typeof id !== "number" || !Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Нет корректного id Telegram." }, { status: 400 });
  }

  if (!verifyTelegramWidgetHash(token, data)) {
    return NextResponse.json({ ok: false, error: "Подпись Telegram недействительна." }, { status: 401 });
  }

  const profile = profileFromVerifiedWidgetData(data);
  if (!profile) {
    return NextResponse.json({ ok: false, error: "Нет корректного id Telegram." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, profile });
}
