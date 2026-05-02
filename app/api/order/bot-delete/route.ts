import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { deleteOrderForOwner } from "@/app/lib/ordersStore";
import { removeSiteBotOrderSnapshot } from "@/app/lib/telegramOrderNotify";

/**
 * POST /api/order/bot-delete — полное удаление заказа из Telegram-бота (только `new`).
 * Тот же секрет, что и у /api/order/update (без cookie).
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

  const result = await deleteOrderForOwner(orderId, Math.floor(telegramUserId));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await removeSiteBotOrderSnapshot(orderId);
  return NextResponse.json({ ok: true });
}
