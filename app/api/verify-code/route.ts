import { NextResponse } from "next/server";
import {
  consumeLoginCodeByCode,
  isLoginCodesRedisEnabled,
  normalizeLoginCodeDigits,
} from "@/app/lib/telegramLoginCodesStore";
import { botVerifyLoginCode } from "@/app/lib/telegramBotRenderApi";
import { syncCartToTelegramBotAfterVerify } from "@/app/lib/telegramCartBotSync";

const SERVICE_UNAVAILABLE_MSG =
  "Сервис входа временно недоступен. Подождите минуту, нажмите «Войти через Telegram» и введите новый код.";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ожидается объект" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const codeRaw = typeof o.code === "string" ? o.code : "";
  const digits = normalizeLoginCodeDigits(codeRaw);
  if (!digits) {
    return NextResponse.json(
      { error: "Введите 4 цифры кода" },
      { status: 400 },
    );
  }

  const username =
    typeof o.username === "string" && o.username.trim()
      ? o.username.trim()
      : undefined;

  const cartPayload =
    Array.isArray(o.cart) && o.cart.length > 0
      ? {
          cart: o.cart,
          deliveryCountry:
            typeof o.deliveryCountry === "string" ? o.deliveryCountry : "BY",
          grandTotal:
            typeof o.grandTotal === "number" ? o.grandTotal : undefined,
        }
      : null;

  const finishVerify = (userId: number, uname?: string) => {
    if (cartPayload) {
      void syncCartToTelegramBotAfterVerify({
        userId,
        cart: cartPayload.cart,
        deliveryCountry: cartPayload.deliveryCountry,
        grandTotal: cartPayload.grandTotal,
      });
    }
    return NextResponse.json({
      ok: true,
      success: true,
      user_id: userId,
      username: uname,
    });
  };

  // Сначала Redis сайта (бот синхронизирует код сюда через sync-login-code).
  const local = await consumeLoginCodeByCode(digits);
  if (local) {
    return finishVerify(local.user_id, local.username);
  }

  if (!isLoginCodesRedisEnabled()) {
    console.error(
      "[verify-code] Redis не настроен на Vercel — код из бота не сохраняется между запросами",
    );
  }

  // Fallback: локальный файл на Render (другой инстанс без sync).
  const botResult = await botVerifyLoginCode({
    code: digits,
    ...(username ? { username } : {}),
    ...(cartPayload ? { cart: cartPayload.cart } : {}),
    ...(cartPayload ? { deliveryCountry: cartPayload.deliveryCountry } : {}),
    ...(cartPayload?.grandTotal != null
      ? { grandTotal: cartPayload.grandTotal }
      : {}),
  });

  if (botResult.ok) {
    return finishVerify(botResult.user_id, botResult.username);
  }

  if (botResult.status === 401) {
    return NextResponse.json(
      { error: botResult.error || "Неверный или просроченный код" },
      { status: 401 },
    );
  }

  if (
    botResult.status === 503 ||
    botResult.status === 502 ||
    botResult.status === 504 ||
    botResult.status === 0
  ) {
    return NextResponse.json({ error: SERVICE_UNAVAILABLE_MSG }, { status: 503 });
  }

  return NextResponse.json(
    { error: botResult.error || "Не удалось проверить код" },
    { status: botResult.status || 502 },
  );
}
