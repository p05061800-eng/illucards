import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { COOKIE_TELEGRAM_USER_ID } from "@/app/lib/telegramUserIdentity";
import { deleteOrderForOwner, getOrder, hideOrderForOwner } from "@/app/lib/ordersStore";
import { removeSiteBotOrderSnapshot } from "@/app/lib/telegramOrderNotify";

function parseUserId(request: NextRequest): number | null {
  const raw = request.cookies.get(COOKIE_TELEGRAM_USER_ID)?.value;
  const n = raw != null ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 1e12) return null;
  return Math.floor(n);
}

/**
 * POST /api/order/delete — удаление заказа из ЛК владельца.
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
  const result = order?.status === "new"
    ? await deleteOrderForOwner(orderId, userId)
    : await hideOrderForOwner(orderId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (order?.status === "new") {
    await removeSiteBotOrderSnapshot(orderId);
  }
  return NextResponse.json({ ok: true });
}
