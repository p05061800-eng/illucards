import { NextRequest, NextResponse } from "next/server";
import {
  listOrdersForUser,
  reconcileBonusDeductionForUser,
  reconcileBonusPointsForUser,
} from "@/app/lib/ordersStore";
import { getTelegramUserState } from "@/app/lib/telegramUserStateStore";

function botBearerAuthorized(request: NextRequest): boolean {
  const secret = process.env.ILLUCARDS_ORDER_UPDATE_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * GET /api/orders?user_id=123
 * Список заказов пользователя (Telegram user_id). Только для бота (Bearer secret).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.ILLUCARDS_ORDER_UPDATE_SECRET?.trim();
  if (secret && !botBearerAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = request.nextUrl.searchParams.get("user_id");
  if (raw == null || raw.trim() === "") {
    return NextResponse.json({ error: "Укажите user_id" }, { status: 400 });
  }
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n <= 0 || n > 1e12) {
    return NextResponse.json({ error: "Некорректный user_id" }, { status: 400 });
  }
  const userId = Math.floor(n);
  await reconcileBonusDeductionForUser(userId).catch(() => undefined);
  await reconcileBonusPointsForUser(userId).catch(() => undefined);
  const orders = await listOrdersForUser(userId);
  const state = await getTelegramUserState(userId);
  return NextResponse.json({
    orders,
    ...(state ? { bonus_points: state.bonus_points } : {}),
  });
}
