import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { normalizeDeliveryCountry, type DeliveryCountry } from "@/app/lib/delivery";
import type { OrderLineIn, OrderRecord, OrderStatus } from "@/app/lib/orderTypes";
import { parseOrderStatusInput } from "@/app/lib/orderStatus";
import { saveOrderRecord, updateOrderStatus } from "@/app/lib/ordersStore";
import { notifyTelegramWebhookUserState } from "@/app/lib/telegramStateBotSync";
import {
  clearSyncedCartForTelegramUser,
  getTelegramUserState,
  trySpendTelegramUserBonusPoints,
} from "@/app/lib/telegramUserStateStore";
import {
  bonusPointsToEarnForOrderItems,
  orderStatusEligibleForBonusAccrual,
} from "@/app/lib/bonusProgram";

function parseUserId(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 1e12) return null;
  return Math.floor(n);
}

function parseDelivery(raw: unknown): DeliveryCountry | null {
  if (typeof raw === "string") return normalizeDeliveryCountry(raw);
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const code = o.country ?? o.code ?? o.deliveryCountry ?? o.delivery_country;
    if (typeof code === "string") {
      const s = code.trim().toUpperCase();
      if (s === "BY" || s === "BYN" || s === "BELARUS") return "BY";
      if (s === "RU" || s === "RUB" || s === "RUSSIA") return "RU";
      if (s === "UA" || s === "UKRAINE") return "UA";
      if (s === "OT" || s === "OTHER") return "OTHER";
    }
  }
  return null;
}

function parseItems(raw: unknown): OrderLineIn[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 80) return null;
  const out: OrderLineIn[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const o = row as Record<string, unknown>;
    const id = String(o.ref ?? o.id ?? "").trim().slice(0, 120);
    const title = String(o.name ?? o.title ?? "").trim().slice(0, 300);
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(o.qty ?? o.quantity) || 1)));
    const priceByn = Number.isFinite(Number(o.priceByn ?? o.price))
      ? Number(o.priceByn ?? o.price)
      : 0;
    const priceRub = Number.isFinite(Number(o.priceRub ?? o.price_rub))
      ? Math.round(Number(o.priceRub ?? o.price_rub))
      : 0;
    if (!id || !title) return null;
    out.push({ id, title, quantity, priceByn, priceRub });
  }
  return out;
}

function parseUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/^@/, "").slice(0, 64);
  return /^[a-zA-Z0-9_]+$/.test(t) ? t : null;
}

function parsePositiveInt(raw: unknown): number | undefined {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

function parseOptionalOrderId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  if (!id || id.length > 200 || /[/\\]/.test(id) || id.includes("..")) return null;
  return id;
}

export async function POST(request: NextRequest) {
  const secret = process.env.ILLUCARDS_ORDER_UPDATE_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ожидается объект JSON" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const userId = parseUserId(o.user_id ?? o.telegramUserId);
  const items = parseItems(o.items);
  const delivery = parseDelivery(o.delivery ?? o.delivery_country);
  const total = typeof o.total === "number" ? o.total : Number(o.total);
  if (userId == null) {
    return NextResponse.json({ error: "Некорректный user_id" }, { status: 400 });
  }
  if (!items) {
    return NextResponse.json({ error: "Некорректные позиции заказа" }, { status: 400 });
  }
  if (!delivery) {
    return NextResponse.json({ error: "Некорректная доставка" }, { status: 400 });
  }
  if (!Number.isFinite(total) || total < 0) {
    return NextResponse.json({ error: "Некорректная сумма заказа" }, { status: 400 });
  }

  const requestedStatus =
    parseOrderStatusInput(o.status) ??
    (o.paid === true ? "paid" : "new");
  const initialStatus: OrderStatus = "new";
  const bonusPointsSpent = parsePositiveInt(o.bonus_points_spent ?? o.bonusApplied);
  if (bonusPointsSpent != null) {
    const spendResult = await trySpendTelegramUserBonusPoints(userId, bonusPointsSpent);
    if (!spendResult.ok) {
      return NextResponse.json(
        { error: "Недостаточно бонусов для списания" },
        { status: 409 },
      );
    }
    await notifyTelegramWebhookUserState({
      userId,
      cart: spendResult.state.cart,
      favorites: spendResult.state.favorites,
      deliveryCountry: spendResult.state.deliveryCountry,
      bonus_points: spendResult.state.bonus_points,
    });
  }
  const orderId = parseOptionalOrderId(o.order_id ?? o.id) ?? randomUUID();
  const record: OrderRecord = {
    user_id: userId,
    username: parseUsername(o.username),
    items,
    total,
    delivery,
    status: initialStatus,
    ...(bonusPointsSpent != null ? { bonus_points_spent: bonusPointsSpent } : {}),
  };

  await saveOrderRecord(orderId, record);
  if (requestedStatus !== "new") {
    const updateResult = await updateOrderStatus(orderId, requestedStatus);
    if (!updateResult.ok) {
      return NextResponse.json(
        { error: updateResult.error },
        { status: updateResult.status },
      );
    }
  }
  if (requestedStatus === "confirmed" || requestedStatus === "paid") {
    try {
      const st = await clearSyncedCartForTelegramUser(userId);
      await notifyTelegramWebhookUserState({
        userId,
        cart: st.cart,
        favorites: st.favorites,
        deliveryCountry: st.deliveryCountry,
        bonus_points: st.bonus_points,
        cartClearedAt: st.cartClearedAt,
      });
    } catch {
      /* Очистка корзины/синк не должны ломать оформление заказа из бота. */
    }
  }

  const bonusEarned = orderStatusEligibleForBonusAccrual(requestedStatus)
    ? bonusPointsToEarnForOrderItems(items)
    : 0;
  const state = await getTelegramUserState(userId);
  return NextResponse.json({
    ok: true,
    order_id: orderId,
    status: requestedStatus,
    bonus_earned: bonusEarned,
    bonus_points: Math.max(0, Math.floor(state?.bonus_points ?? 0)),
  });
}
