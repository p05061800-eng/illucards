import type { DeliveryCountry } from "@/app/lib/delivery";
import type { OrderLineIn } from "@/app/lib/orderTypes";

const DEFAULT_TELEGRAM_BOT_SYNC_BASE = "https://illucards-telegram-bot.onrender.com";

function botSyncBase(): string {
  return (
    process.env.TELEGRAM_BOT_SYNC_URL?.trim() ||
    process.env.TELEGRAM_SYNC_API_URL?.trim() ||
    DEFAULT_TELEGRAM_BOT_SYNC_BASE
  ).replace(/\/+$/, "");
}

export type SyncOrderToTelegramBotInput = {
  orderId: string;
  userId: number;
  items: OrderLineIn[];
  total: number;
  delivery: DeliveryCountry;
  username?: string | null;
  bonusPointsSpent?: number;
};

/** Best-effort: синхронизация заказа с HTTP API бота (не блокирует UX). */
export async function syncOrderToTelegramBot(
  input: SyncOrderToTelegramBotInput,
): Promise<void> {
  const secret = process.env.TELEGRAM_SYNC_API_SECRET?.trim();
  const order = {
    id: input.orderId,
    order_id: input.orderId,
    items: input.items,
    total: input.total,
    delivery: input.delivery,
    user_id: input.userId,
    status: "new",
    ...(input.bonusPointsSpent != null && input.bonusPointsSpent > 0
      ? { bonus_points_spent: input.bonusPointsSpent }
      : {}),
    ...(input.username ? { username: input.username } : {}),
  };

  try {
    const res = await fetch(`${botSyncBase()}/api/sync/cart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "X-Sync-Secret": secret } : {}),
      },
      body: JSON.stringify({
        cart: input.items,
        user_id: input.userId,
        telegram_user_id: input.userId,
        order_id: input.orderId,
        order,
        session: {
          source: "vercel_order_create",
          created_at: Date.now(),
        },
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
      const msg =
        typeof data?.error === "string" ? data.error : `HTTP ${res.status}`;
      console.warn("telegram cart sync failed:", msg);
    }
  } catch (error: unknown) {
    console.warn(
      "telegram cart sync unavailable:",
      error instanceof Error ? error.message : error,
    );
  }
}
