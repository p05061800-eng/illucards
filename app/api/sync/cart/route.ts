import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  normalizeOrderItems,
  parseDeliveryCountry,
  parseOptionalTelegramUserId,
} from "@/app/lib/orderCreateShared";
import { syncOrderToTelegramBot } from "@/app/lib/telegramCartBotSync";

export async function POST(request: NextRequest) {
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
  const userId = parseOptionalTelegramUserId(
    o.user_id ?? o.telegram_user_id,
  );
  if (userId == null) {
    return NextResponse.json({ error: "Invalid user_id" }, { status: 400 });
  }

  const items = normalizeOrderItems(o.cart) ?? [];
  const orderRaw = o.order;
  const orderId =
    typeof o.order_id === "string"
      ? o.order_id.trim()
      : orderRaw &&
          typeof orderRaw === "object" &&
          orderRaw !== null &&
          typeof (orderRaw as { order_id?: unknown }).order_id === "string"
        ? (orderRaw as { order_id: string }).order_id.trim()
        : "";

  const delivery = parseDeliveryCountry(
    orderRaw && typeof orderRaw === "object" && orderRaw !== null
      ? (orderRaw as Record<string, unknown>).delivery
      : undefined,
  ) ?? "BY";
  let total = 0;
  let bonusPointsSpent: number | undefined;
  let username: string | null | undefined;

  if (orderRaw && typeof orderRaw === "object" && orderRaw !== null) {
    const ord = orderRaw as Record<string, unknown>;
    total = typeof ord.total === "number" ? ord.total : Number(ord.total) || 0;
    if (typeof ord.bonus_points_spent === "number") {
      bonusPointsSpent = Math.floor(ord.bonus_points_spent);
    }
    if (typeof ord.username === "string") {
      username = ord.username.trim() || null;
    }
  }

  if (!orderId) {
    return NextResponse.json({ error: "order_id required" }, { status: 400 });
  }

  await syncOrderToTelegramBot({
    orderId,
    userId,
    items,
    total,
    delivery,
    username,
    bonusPointsSpent,
  });

  return NextResponse.json({ ok: true, order_id: orderId });
}
