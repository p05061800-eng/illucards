import type { NextRequest } from "next/server";
import { after, NextResponse } from "next/server";
import {
  normalizeOrderItems,
  parseDeliveryCountry,
  parseOptionalTelegramUserId,
  parseOptionalUsername,
  persistOrder,
} from "@/app/lib/orderCreateShared";
import { syncOrderToTelegramBot } from "@/app/lib/telegramCartBotSync";
import { recordAndNotifyTelegramOrder } from "@/app/lib/telegramOrderNotify";
import { botNotify } from "@/app/lib/telegramBotRenderApi";
import { notifyTelegramWebhookUserState } from "@/app/lib/telegramStateBotSync";
import { getTelegramUserState } from "@/app/lib/telegramUserStateStore";

/**
 * Создание заказа.
 * Body: { user_id?, items, total, delivery }
 * Ответ: { order_id: string }
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Ожидается объект JSON" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const delivery = parseDeliveryCountry(o.delivery);
  if (!delivery) {
    return NextResponse.json(
      { error: "Укажите страну доставки (delivery)" },
      { status: 400 },
    );
  }

  const items = normalizeOrderItems(o.items);
  if (!items) {
    return NextResponse.json(
      { error: "Корзина пуста или данные позиций некорректны" },
      { status: 400 },
    );
  }

  const total =
    typeof o.total === "number" ? o.total : Number(o.total);
  const userId = parseOptionalTelegramUserId(o.user_id);
  if (userId == null) {
    return NextResponse.json(
      { error: "Сначала войдите через Telegram" },
      { status: 401 },
    );
  }
  const username = parseOptionalUsername(o.username);

  const result = await persistOrder({
    deliveryCountry: delivery,
    items,
    userId,
    username: username ?? null,
    clientTotalByn: total,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const syncInput = {
    orderId: result.orderId,
    userId,
    items,
    total: result.totalByn,
    delivery,
    username: username ?? null,
    // Бот шлёт заказ в чат, если сайт не отправил сам (как в 54b1ddb).
    skipBuyerNotify: false,
  };

  // Синк до ответа: пользователь должен увидеть заказ в Telegram сразу после checkout.
  let botSyncOk = false;
  let buyerNotified = false;
  try {
    await syncOrderToTelegramBot(syncInput);
    await recordAndNotifyTelegramOrder({
      orderId: result.orderId,
      userId,
      items,
      total: result.totalByn,
      delivery,
    });
    botSyncOk = true;
    buyerNotified = true;
  } catch (error: unknown) {
    console.warn("[checkout] bot sync failed before redirect", {
      order_id: result.orderId,
      error: error instanceof Error ? error.message : error,
    });
    const fallback = await botNotify({
      target: "customer",
      telegramUserId: userId,
      text:
        "Заказ оформлен на сайте IlluCards.\n\n"
        + `Откройте бота и отправьте команду:\n/start order_${result.orderId}`,
    });
    if (fallback.ok) {
      buyerNotified = true;
      console.info("[checkout] bot notify fallback ok", {
        order_id: result.orderId,
        user_id: userId,
      });
    }
  }

  after(async () => {
    try {
      const state = await getTelegramUserState(userId);
      if (state) {
        await notifyTelegramWebhookUserState({
          userId,
          cart: state.cart,
          favorites: state.favorites,
          deliveryCountry: state.deliveryCountry,
        });
      }
    } catch (error: unknown) {
      console.warn("[checkout] post-create state sync failed", {
        order_id: result.orderId,
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  console.info("[checkout] order created, redirect to bot", {
    order_id: result.orderId,
    user_id: userId,
  });

  return NextResponse.json({
    order_id: result.orderId,
    total: result.totalByn,
    telegram_recorded: botSyncOk,
    telegram_sent: buyerNotified,
    telegram_bot_start: `order_${result.orderId}`,
  });
}
