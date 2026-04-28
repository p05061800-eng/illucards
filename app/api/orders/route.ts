import { NextRequest, NextResponse } from "next/server";
import { listOrdersForUser } from "@/app/lib/ordersStore";

/**
 * GET /api/orders?user_id=123
 * Список заказов с указанным Telegram user_id.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("user_id");
  if (raw == null || raw.trim() === "") {
    return NextResponse.json({ error: "Укажите user_id" }, { status: 400 });
  }
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n <= 0 || n > 1e12) {
    return NextResponse.json({ error: "Некорректный user_id" }, { status: 400 });
  }
  const userId = Math.floor(n);
  const orders = await listOrdersForUser(userId);
  return NextResponse.json({ orders });
}
