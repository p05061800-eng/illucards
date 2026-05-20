import { TELEGRAM_ORDER_BOT_DEFAULT } from "@/app/lib/telegramOrderCheckout";
import type { DeliveryCountry } from "@/app/lib/delivery";
import type { OrderLineIn } from "@/app/lib/orderTypes";

export type TelegramOrderSyncResult = {
  ok: boolean;
  startPayload?: string;
  draftId?: string;
  telegramUrl?: string;
  error?: string;
};

function resolveBotUsername(): string {
  const raw =
    process.env.NEXT_PUBLIC_TELEGRAM_ORDER_BOT_USERNAME ||
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ||
    process.env.TELEGRAM_ORDER_BOT_USERNAME ||
    process.env.TELEGRAM_BOT_USERNAME ||
    "";
  return raw.replace(/^@/, "").trim() || TELEGRAM_ORDER_BOT_DEFAULT;
}

export function telegramOrderDeepLink(startPayload: string): string {
  const bot = resolveBotUsername();
  return `https://t.me/${encodeURIComponent(bot)}?start=${encodeURIComponent(startPayload)}`;
}

function readString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export async function syncTelegramOrderDraft(input: {
  orderId: string;
  userId: number;
  username?: string | null;
  items: OrderLineIn[];
  total: number;
  delivery: DeliveryCountry;
  bonusPointsSpent?: number;
}): Promise<TelegramOrderSyncResult> {
  const base = (process.env.TELEGRAM_SYNC_API_URL || "").trim().replace(/\/+$/, "");
  if (!base) return { ok: false, error: "TELEGRAM_SYNC_API_URL is not configured" };

  const secret = (process.env.TELEGRAM_SYNC_API_SECRET || "").trim();
  try {
    const res = await fetch(`${base}/api/sync/order/telegram`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "X-Sync-Secret": secret } : {}),
      },
      body: JSON.stringify({
        order_id: input.orderId,
        user_id: input.userId,
        username: input.username ?? undefined,
        items: input.items,
        total: input.total,
        delivery: input.delivery,
        bonus_points_spent: input.bonusPointsSpent,
      }),
      cache: "no-store",
    });

    const data: unknown = await res.json().catch(() => null);
    if (!res.ok || !data || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, error: `Telegram sync failed: HTTP ${res.status}` };
    }

    const obj = data as Record<string, unknown>;
    const telegramUrl = readString(obj, ["telegram_url", "telegramUrl", "url", "link"]);
    const startPayload = readString(obj, ["start_payload", "startPayload", "payload"]);
    const draftId = readString(obj, ["draft_id", "draftId", "draft"]);

    return {
      ok: true,
      ...(startPayload ? { startPayload } : {}),
      ...(draftId ? { draftId } : {}),
      ...(telegramUrl ? { telegramUrl } : {}),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Telegram sync failed",
    };
  }
}
