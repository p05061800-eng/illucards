import { NextResponse, type NextRequest } from "next/server";
import { getOrder } from "@/app/lib/ordersStore";
import {
  syncTelegramOrderDraft,
  telegramOrderDeepLink,
} from "@/app/lib/telegramOrderSync";

function readString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  return typeof value === "string" ? value.trim() : "";
}

function readTelegramUserId(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Ожидается объект JSON" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const orderId = readString(input, "order_id") || readString(input, "orderId");
  if (!orderId) {
    return NextResponse.json({ error: "Укажите order_id" }, { status: 400 });
  }

  const order = await getOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  const userId = readTelegramUserId(input.user_id) ?? readTelegramUserId(order.user_id);
  if (userId == null) {
    return NextResponse.json({ error: "У заказа нет Telegram user_id" }, { status: 400 });
  }

  const sync = await syncTelegramOrderDraft({
    orderId,
    userId,
    username: order.username,
    items: order.items,
    total: order.total,
    delivery: order.delivery,
    bonusPointsSpent: order.bonus_points_spent,
  });
  const startPayload =
    sync.startPayload || (sync.draftId ? `ORDER_${sync.draftId}` : `order_${orderId}`);
  const telegramUrl =
    sync.telegramUrl && sync.telegramUrl.includes("?start=")
      ? sync.telegramUrl
      : telegramOrderDeepLink(startPayload);

  return NextResponse.json({
    ok: sync.ok,
    ...(sync.error ? { error: sync.error } : {}),
    start_payload: startPayload,
    ...(sync.draftId ? { draft_id: sync.draftId } : {}),
    telegram_url: telegramUrl,
  });
}
