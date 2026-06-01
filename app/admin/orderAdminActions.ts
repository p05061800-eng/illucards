"use server";

import { revalidatePath } from "next/cache";
import {
  getOrder,
  listRecentOrders,
  updateOrderStatus,
  type AdminOrderRow,
} from "@/app/lib/ordersStore";
import { notifyBotAwaitOrderDetails } from "@/app/lib/telegramCartBotSync";
import { sendOrderDetailsRequestToCustomer } from "@/app/lib/telegramOrderCustomerNotify";
import { notifyTelegramWebhookUserState } from "@/app/lib/telegramStateBotSync";
import { clearSyncedCartForTelegramUser } from "@/app/lib/telegramUserStateStore";

export async function loadAdminOrders(): Promise<AdminOrderRow[]> {
  return listRecentOrders(50);
}

export async function confirmOrderFromAdmin(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = orderId.trim();
  if (!id) return { ok: false, error: "Некорректный id заказа" };

  const existing = await getOrder(id);
  if (!existing) return { ok: false, error: "Заказ не найден" };
  if (existing.status === "cancelled") {
    return { ok: false, error: "Заказ отменён" };
  }
  if (existing.status === "confirmed") {
    return { ok: false, error: "Заказ уже подтверждён" };
  }
  if (!existing.payment_method) {
    return {
      ok: false,
      error: "Сначала покупатель должен выбрать способ оплаты в Telegram",
    };
  }

  const result = await updateOrderStatus(id, "confirmed");
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  if (existing.user_id != null && existing.user_id > 0) {
    const uid = Math.floor(existing.user_id);
    try {
      const st = await clearSyncedCartForTelegramUser(uid);
      await notifyTelegramWebhookUserState({
        userId: uid,
        cart: st.cart,
        favorites: st.favorites,
        deliveryCountry: st.deliveryCountry,
        bonus_points: st.bonus_points,
        cartClearedAt: st.cartClearedAt,
      });
    } catch {
      /* ignore */
    }
    await sendOrderDetailsRequestToCustomer(uid);
    void notifyBotAwaitOrderDetails(uid, id);
  }

  revalidatePath("/admin");
  return { ok: true };
}
