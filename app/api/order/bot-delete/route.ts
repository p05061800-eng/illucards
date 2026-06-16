import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getOrder } from "@/app/lib/ordersStore";

/**
 * POST /api/order/bot-delete — legacy endpoint from бота.
 * Заказы не удаляются: при необходимости только отмена (status cancelled).
 * Body: { order_id: string, telegram_user_id: number }
 */
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
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Ожидается объект JSON" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const orderId = typeof o.order_id === "string" ? o.order_id.trim() : "";
  const uidRaw = o.telegram_user_id ?? o.user_id;
  const telegramUserId =
    typeof uidRaw === "number" ? uidRaw : uidRaw != null ? Number(uidRaw) : NaN;
  if (!orderId) {
    return NextResponse.json({ error: "Укажите order_id" }, { status: 400 });
  }
  if (!Number.isFinite(telegramUserId) || telegramUserId <= 0 || telegramUserId > 1e12) {
    return NextResponse.json({ error: "Укажите telegram_user_id" }, { status: 400 });
  }

  const order = await getOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }
  const owner = order.user_id;
  if (owner == null || Math.floor(owner) !== Math.floor(telegramUserId)) {
    return NextResponse.json({ error: "Нет доступа к этому заказу" }, { status: 403 });
  }

  if (order.status === "new") {
    return NextResponse.json({
      ok: true,
      status: "new",
      deleted: false,
      message: "Заказ в обработке — удаление отключено до подтверждения администратором",
    });
  }

  if (order.status === "cancelled") {
    return NextResponse.json({ ok: true, status: "cancelled", deleted: false });
  }

  return NextResponse.json({
    ok: true,
    status: order.status,
    deleted: false,
    message: "Заказ сохранён; удаление отключено",
  });
}
