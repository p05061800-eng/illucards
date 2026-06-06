import type { DeliveryCountry } from "@/app/lib/delivery";
import type { SyncedCartItem } from "@/app/lib/telegramUserStateStore";
import {
  telegramBotApiUrl,
  telegramBotSyncHeaders,
} from "@/app/lib/telegramBotRenderApi";

/**
 * Пуш синхронизированного состояния на Render-бот (если настроен URL).
 */
export async function notifyTelegramWebhookUserState(opts: {
  userId: number;
  cart: SyncedCartItem[];
  favorites: string[];
  deliveryCountry: DeliveryCountry | null;
  bonus_points?: number;
  bonusEarned?: number;
  cartClearedAt?: number;
}): Promise<void> {
  const base = telegramBotApiUrl();
  if (!base) return;
  try {
    const res = await fetch(`${base}/api/sync/state`, {
      method: "POST",
      headers: telegramBotSyncHeaders(),
      body: JSON.stringify({
        user_id: opts.userId,
        delivery_country: opts.deliveryCountry,
        ...(typeof opts.bonus_points === "number" && Number.isFinite(opts.bonus_points)
          ? { bonus_points: Math.max(0, Math.floor(opts.bonus_points)) }
          : {}),
        ...(typeof opts.bonusEarned === "number" && Number.isFinite(opts.bonusEarned)
          ? { bonusEarned: Math.max(0, Math.floor(opts.bonusEarned)) }
          : {}),
        ...(typeof opts.cartClearedAt === "number" && Number.isFinite(opts.cartClearedAt)
          ? { cartClearedAt: Math.floor(opts.cartClearedAt) }
          : {}),
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
    if (!res.ok) {
      console.warn("[telegram-bot] sync/state failed:", res.status);
    }
  } catch {
    /* вторично */
  }
}
