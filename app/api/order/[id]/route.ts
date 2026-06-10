import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getOrder } from "@/app/lib/ordersStore";
import { COOKIE_TELEGRAM_USER_ID } from "@/app/lib/telegramUserIdentity";

function parseCookieUserId(request: NextRequest): number | null {
  const raw = request.cookies.get(COOKIE_TELEGRAM_USER_ID)?.value;
  const n = raw != null ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 1e12) return null;
  return Math.floor(n);
}

function botBearerAuthorized(request: Request): boolean {
  const secret = process.env.ILLUCARDS_ORDER_UPDATE_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** GET /api/order/{id} — бот (Bearer) или владелец заказа (cookie Telegram). */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) {
    console.warn("[order] GET not found", { id, status: 404 });
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  const viaBot = botBearerAuthorized(request);
  if (!viaBot) {
    const userId = parseCookieUserId(request);
    if (userId == null) {
      return NextResponse.json({ error: "Требуется вход через Telegram" }, { status: 401 });
    }
    const owner = order.user_id;
    if (owner == null || Math.floor(owner) !== userId) {
      return NextResponse.json({ error: "Нет доступа к этому заказу" }, { status: 403 });
    }
  }

  console.info("[order] GET ok", {
    id,
    status: 200,
    items: order.items?.length ?? 0,
    viaBot,
  });
  return NextResponse.json({
    id,
    ...order,
    grandTotal: order.total,
  });
}
