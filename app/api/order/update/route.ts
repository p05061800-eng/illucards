import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parseOrderStatusInput } from "@/app/lib/orderStatus";
import { getOrder, updateOrderStatus } from "@/app/lib/ordersStore";
import { notifyTelegramWebhookUserState } from "@/app/lib/telegramStateBotSync";
import { clearSyncedCartForTelegramUser } from "@/app/lib/telegramUserStateStore";

/**
 * Обновление статуса заказа (в т.ч. из Telegram-бота).
 * Body: { order_id: string, status: string }
 *
 * Если задан ILLUCARDS_ORDER_UPDATE_SECRET — требуется заголовок
 * Authorization: Bearer <secret>
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
  const status = parseOrderStatusInput(o.status);
  if (!orderId) {
    return NextResponse.json({ error: "Укажите order_id" }, { status: 400 });
  }
  if (!status) {
    return NextResponse.json({ error: "Некорректный status" }, { status: 400 });
  }

  const existing = await getOrder(orderId);
  const result = await updateOrderStatus(orderId, status);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  /**
   * После «Принят» (`confirmed`, в т.ч. админ/бот) и после «чек отправил» (`paid`):
   * очищаем синхронизированную корзину и шлём актуальный user-state (бонусы + пустая корзина) в бот и на клиент.
   * Повторный вызов для того же пользователя безопасен.
   */
  if (
    (status === "confirmed" || status === "paid") &&
    existing?.user_id != null
  ) {
    const uid = Math.floor(existing.user_id);
    if (uid > 0) {
      try {
        const st = await clearSyncedCartForTelegramUser(uid);
        await notifyTelegramWebhookUserState({
          userId: uid,
          cart: st.cart,
          favorites: st.favorites,
          deliveryCountry: st.deliveryCountry,
          bonus_points: st.bonus_points,
        });
      } catch {
        /* очистка/синк не должны ломать смену статуса */
      }
    }
  }

  return NextResponse.json({ ok: true });
}
