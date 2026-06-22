/** После «Авторизоваться через телеграм для заказа» — оформить заказ сразу после входа. */
export const TG_PENDING_CHECKOUT_KEY = "illucards_tg_pending_checkout";

export function stashPendingTelegramCheckout(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(TG_PENDING_CHECKOUT_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function readPendingTelegramCheckout(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(TG_PENDING_CHECKOUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearPendingTelegramCheckout(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(TG_PENDING_CHECKOUT_KEY);
  } catch {
    /* ignore */
  }
}
