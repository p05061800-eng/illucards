import type { NextRequest } from "next/server";
import { after, NextResponse } from "next/server";
import {
  normalizeOrderItems,
  parseDeliveryCountry,
  parseOptionalBonusPointsToSpend,
  parseOptionalTelegramUserId,
  parseOptionalUsername,
  persistOrder,
} from "@/app/lib/orderCreateShared";
import { syncOrderToTelegramBot } from "@/app/lib/telegramCartBotSync";
import { recordAndNotifyTelegramOrder } from "@/app/lib/telegramOrderNotify";
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
  const bonusPointsToSpend = parseOptionalBonusPointsToSpend(
    o.bonus_points_to_spend ?? o.bonusPointsToSpend,
  );

  const result = await persistOrder({
    deliveryCountry: delivery,
    items,
    userId,
    username: username ?? null,
    clientTotalByn: total,
    bonusPointsToSpend,
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
    bonusPointsSpent: result.bonusPointsSpent,
    skipBuyerNotify: true,
  };

  after(async () => {
    try {
      const state = await getTelegramUserState(userId);
      if (state) {
        await notifyTelegramWebhookUserState({
          userId,
          cart: state.cart,
          favorites: state.favorites,
          deliveryCountry: state.deliveryCountry,
          bonus_points: state.bonus_points,
        });
      }
      await syncOrderToTelegramBot(syncInput);
      await recordAndNotifyTelegramOrder({
        orderId: result.orderId,
        userId,
        items,
        total: result.totalByn,
        delivery,
        bonusPointsSpent: result.bonusPointsSpent,
      });
    } catch (error: unknown) {
      console.warn("[checkout] post-create sync failed", {
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
    bonus_points_spent: result.bonusPointsSpent,
    bonus_points: result.bonusPointsBalance,
    telegram_recorded: true,
    telegram_sent: false,
    telegram_bot_start: `order_${result.orderId}`,
  });
}
