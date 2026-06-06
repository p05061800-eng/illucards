import { NextResponse } from "next/server";
import { consumeLoginCodeByCode } from "@/app/lib/telegramLoginCodesStore";
import { botVerifyLoginCode } from "@/app/lib/telegramBotRenderApi";
import { syncCartToTelegramBotAfterVerify } from "@/app/lib/telegramCartBotSync";

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
  const digits = codeRaw.replace(/\D/g, "");
  if (digits.length !== 4) {
    return NextResponse.json(
      { error: "Введите 4 цифры кода" },
      { status: 400 },
    );
  }

  const username =
    typeof o.username === "string" && o.username.trim()
      ? o.username.trim()
      : undefined;

  const botResult = await botVerifyLoginCode({
    code: digits,
    ...(username ? { username } : {}),
    ...(Array.isArray(o.cart) ? { cart: o.cart } : {}),
    ...(typeof o.deliveryCountry === "string"
      ? { deliveryCountry: o.deliveryCountry }
      : {}),
    ...(typeof o.grandTotal === "number" ? { grandTotal: o.grandTotal } : {}),
    ...(typeof o.bonusPoints === "number"
      ? { bonusPoints: o.bonusPoints }
      : {}),
  });

  if (botResult.ok) {
    if (Array.isArray(o.cart) && o.cart.length > 0) {
      void syncCartToTelegramBotAfterVerify({
        userId: botResult.user_id,
        cart: o.cart,
        deliveryCountry:
          typeof o.deliveryCountry === "string" ? o.deliveryCountry : "BY",
        grandTotal:
          typeof o.grandTotal === "number" ? o.grandTotal : undefined,
        bonusPoints:
          typeof o.bonusPoints === "number" ? o.bonusPoints : undefined,
      });
    }
    return NextResponse.json({
      ok: true,
      success: true,
      user_id: botResult.user_id,
      username: botResult.username,
    });
  }

  if (botResult.status !== 0 && botResult.status !== 503) {
    return NextResponse.json(
      { error: botResult.error || "Неверный или просроченный код" },
      { status: botResult.status === 401 ? 401 : botResult.status || 502 },
    );
  }

  const local = await consumeLoginCodeByCode(digits);
  if (!local) {
    return NextResponse.json(
      { error: "Неверный или просроченный код" },
      { status: 401 },
    );
  }

  if (Array.isArray(o.cart) && o.cart.length > 0) {
    void syncCartToTelegramBotAfterVerify({
      userId: local.user_id,
      cart: o.cart,
      deliveryCountry:
        typeof o.deliveryCountry === "string" ? o.deliveryCountry : "BY",
      grandTotal:
        typeof o.grandTotal === "number" ? o.grandTotal : undefined,
      bonusPoints:
        typeof o.bonusPoints === "number" ? o.bonusPoints : undefined,
    });
  }

  return NextResponse.json({
    ok: true,
    success: true,
    user_id: local.user_id,
    username: local.username,
  });
}
