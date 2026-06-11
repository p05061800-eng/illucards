import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { setOrderTelegramAdminMessageId } from "@/app/lib/ordersStore";

/**
 * POST /api/order/admin-message — бот сохраняет message_id уведомления админу.
 * Authorization: Bearer ILLUCARDS_ORDER_UPDATE_SECRET (если задан).
 * Body: { order_id: string, admin_message_id: number }
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
  const midRaw = o.admin_message_id ?? o.telegram_admin_message_id;
  const messageId = typeof midRaw === "number" ? midRaw : Number(midRaw);
  if (!orderId) {
    return NextResponse.json({ error: "Укажите order_id" }, { status: 400 });
  }
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return NextResponse.json({ error: "Укажите admin_message_id" }, { status: 400 });
  }

  const result = await setOrderTelegramAdminMessageId(orderId, messageId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
