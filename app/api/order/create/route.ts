import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  normalizeOrderItems,
  parseDeliveryCountry,
  parseOptionalBonusPointsToSpend,
  parseOptionalTelegramUserId,
  parseOptionalUsername,
  persistOrder,
} from "@/app/lib/orderCreateShared";
import { recordAndNotifyTelegramOrder } from "@/app/lib/telegramOrderNotify";

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

  const telegram = await recordAndNotifyTelegramOrder({
    orderId: result.orderId,
    userId,
    items,
    total: result.totalByn,
    delivery,
    bonusPointsSpent: result.bonusPointsSpent,
  });

  return NextResponse.json({
    order_id: result.orderId,
    total: result.totalByn,
    bonus_points_spent: result.bonusPointsSpent,
    telegram_recorded: telegram.recorded,
    telegram_sent: telegram.sent,
  });
}
