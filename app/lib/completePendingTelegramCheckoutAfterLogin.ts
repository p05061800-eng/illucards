import { readClientCheckoutSnapshot } from "@/app/context/CartContext";
import {
  clearPendingTelegramCheckout,
  readPendingTelegramCheckout,
} from "@/app/lib/pendingTelegramCheckout";
import { submitTelegramCheckoutOrder } from "@/app/lib/submitTelegramCheckoutOrder";
import { redirectToTelegramUrl } from "@/app/lib/yandexMetrika";
import { TG_LOGIN_AUTO_ERROR_KEY } from "@/app/lib/telegramLoginWaitKeys";
import { readTelegramUserLink } from "@/app/lib/telegramUserIdentity";

export type PendingCheckoutOutcome =
  | "redirected"
  | "not_pending"
  | "failed"
  | "in_progress";

let pendingCheckoutInFlight = false;

export function isPendingTelegramCheckoutInFlight(): boolean {
  return pendingCheckoutInFlight;
}

function stashCheckoutError(message: string): void {
  try {
    sessionStorage.setItem(TG_LOGIN_AUTO_ERROR_KEY, message);
  } catch {
    /* ignore */
  }
}

/** Если вход был из корзины — создать заказ и открыть бота. */
export async function completePendingTelegramCheckoutAfterLogin(
  userId: number,
  username?: string | null,
): Promise<PendingCheckoutOutcome> {
  if (pendingCheckoutInFlight) {
    return "in_progress";
  }
  if (!readPendingTelegramCheckout()) {
    return "not_pending";
  }
  pendingCheckoutInFlight = true;
  clearPendingTelegramCheckout();

  try {
    const snapshot = readClientCheckoutSnapshot();
    if (!snapshot || snapshot.cartItems.length === 0 || !snapshot.deliveryCountry) {
      stashCheckoutError(
        "Вход выполнен. Выберите доставку в корзине и нажмите «Оформить заказ через телеграм бот».",
      );
      return "failed";
    }

    const uname =
      username?.trim() ||
      readTelegramUserLink()?.username?.trim() ||
      undefined;

    const result = await submitTelegramCheckoutOrder({
      userId,
      username: uname,
      cartItems: snapshot.cartItems,
      deliveryCountry: snapshot.deliveryCountry,
      orderTotalByn: snapshot.orderTotalByn,
    });

    if (!result.ok) {
      stashCheckoutError(
        result.status === 401
          ? "Сначала войдите через Telegram и повторите оформление заказа."
          : result.error,
      );
      return "failed";
    }

    if (!result.telegramSent && result.syncError) {
      console.warn(
        "[checkout] bot did not receive order before redirect",
        result.syncError,
      );
    }

    redirectToTelegramUrl(result.botUrl);
    return "redirected";
  } finally {
    pendingCheckoutInFlight = false;
  }
}
