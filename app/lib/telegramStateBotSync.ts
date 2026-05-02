import type { DeliveryCountry } from "@/app/lib/delivery";
import type { SyncedCartItem } from "@/app/lib/telegramUserStateStore";

/**
 * Пуш синхронизированного состояния на внешний сервис бота (если настроен).
 */
export async function notifyTelegramWebhookUserState(opts: {
  userId: number;
  cart: SyncedCartItem[];
  favorites: string[];
  deliveryCountry: DeliveryCountry | null;
}): Promise<void> {
  const base = (process.env.TELEGRAM_SYNC_API_URL || "").trim().replace(/\/+$/, "");
  if (!base) return;
  const secret = (process.env.TELEGRAM_SYNC_API_SECRET || "").trim();
  try {
    await fetch(`${base}/api/sync/state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "X-Sync-Secret": secret } : {}),
      },
      body: JSON.stringify({
        user_id: opts.userId,
        delivery_country: opts.deliveryCountry,
        cart: opts.cart.map((x) => ({
          ref: x.id,
          name: x.title,
          price: x.priceByn,
          price_rub: x.priceRub,
          qty: x.quantity,
        })),
        favorites: opts.favorites.map((id) => ({ ref: id })),
      }),
      cache: "no-store",
    });
  } catch {
    /* вторично */
  }
}
