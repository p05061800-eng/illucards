import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { COOKIE_TELEGRAM_USER_ID } from "@/app/lib/telegramUserIdentity";
import { deleteAdminTelegramOrderMessage } from "@/app/lib/telegramAdminOrderMessage";
import { getOrder, updateOrderStatus } from "@/app/lib/ordersStore";
import type { OrderStatus } from "@/app/lib/orderTypes";

function parseUserId(request: NextRequest): number | null {
  const raw = request.cookies.get(COOKIE_TELEGRAM_USER_ID)?.value;
  const n = raw != null ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 1e12) return null;
  return Math.floor(n);
}

/** Покупатель может отменить с сайта только до подтверждения в Telegram (статус `new`). */
function canCustomerCancel(status: OrderStatus): boolean {
  return status === "new";
}

/**
 * POST /api/order/cancel — отмена заказа владельцем (cookie Telegram).
 * Body: { order_id: string }
 */
export async function POST(request: NextRequest) {
  const userId = parseUserId(request);
  if (userId == null) {
    return NextResponse.json({ error: "Требуется вход через Telegram" }, { status: 401 });
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
  if (!orderId) {
    return NextResponse.json({ error: "Укажите order_id" }, { status: 400 });
  }

  const order = await getOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  const owner = order.user_id;
  if (owner == null || Math.floor(owner) !== userId) {
    return NextResponse.json({ error: "Нет доступа к этому заказу" }, { status: 403 });
  }

  if (order.status === "cancelled") {
    return NextResponse.json({ ok: true, status: "cancelled" });
  }

  if (!canCustomerCancel(order.status)) {
    return NextResponse.json(
      {
        error:
          order.status === "confirmed"
            ? "Заказ уже подтверждён в Telegram — отменить с сайта нельзя. Напишите в поддержку."
            : "На этом этапе заказ нельзя отменить самостоятельно — напишите в поддержку.",
      },
      { status: 409 },
    );
  }

  const adminMid = order.telegram_admin_message_id;

  const result = await updateOrderStatus(orderId, "cancelled");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (typeof adminMid === "number" && adminMid > 0) {
    await deleteAdminTelegramOrderMessage(adminMid);
  }

  return NextResponse.json({ ok: true, status: "cancelled" });
}
