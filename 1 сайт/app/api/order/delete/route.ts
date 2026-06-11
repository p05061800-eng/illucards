import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { COOKIE_TELEGRAM_USER_ID } from "@/app/lib/telegramUserIdentity";
import { getOrder, hideOrderForOwner } from "@/app/lib/ordersStore";

function parseUserId(request: NextRequest): number | null {
  const raw = request.cookies.get(COOKIE_TELEGRAM_USER_ID)?.value;
  const n = raw != null ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 1e12) return null;
  return Math.floor(n);
}

/**
 * POST /api/order/delete — скрыть заказ из списка в ЛК (данные заказа сохраняются).
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

  const result = await hideOrderForOwner(orderId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, hidden: true });
}
