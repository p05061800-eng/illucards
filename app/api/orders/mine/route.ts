import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { COOKIE_TELEGRAM_USER_ID } from "@/app/lib/telegramUserIdentity";
import { listOrdersForUser } from "@/app/lib/ordersStore";

/**
 * GET /api/orders/mine — список заказов текущего пользователя (cookie telegram_user_id).
 */
export async function GET(request: NextRequest) {
  const raw = request.cookies.get(COOKIE_TELEGRAM_USER_ID)?.value;
  const n = raw != null ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 1e12) {
    return NextResponse.json({ error: "Требуется вход через Telegram" }, { status: 401 });
  }
  const userId = Math.floor(n);
  const orders = await listOrdersForUser(userId);
  return NextResponse.json({ orders });
}
