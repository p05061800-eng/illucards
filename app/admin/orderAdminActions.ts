"use server";

import { revalidatePath } from "next/cache";
import {
  getOrder,
  listRecentOrders,
  purgeAllOrders,
  updateOrderStatus,
  type AdminOrderRow,
} from "@/app/lib/ordersStore";
import { botPurgeOrders } from "@/app/lib/telegramBotRenderApi";
import { notifyBotAwaitOrderDetails } from "@/app/lib/telegramCartBotSync";
import { sendOrderDetailsRequestToCustomer } from "@/app/lib/telegramOrderCustomerNotify";

export async function loadAdminOrders(): Promise<AdminOrderRow[]> {
  return listRecentOrders(50);
}

export async function purgeAllOrdersFromAdmin(): Promise<
  { ok: true; siteDeleted: number; botDeleted: number } | { ok: false; error: string }
> {
  const site = await purgeAllOrders();
  const bot = await botPurgeOrders();
  if (!bot.ok) {
    return {
      ok: false,
      error: `Сайт очищен (${site.siteDeleted}), бот: ${bot.error}`,
    };
  }
  revalidatePath("/admin");
  revalidatePath("/account/orders");
  return {
    ok: true,
    siteDeleted: site.siteDeleted,
    botDeleted: bot.deleted,
  };
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
    await sendOrderDetailsRequestToCustomer(uid);
    void notifyBotAwaitOrderDetails(uid, id);
  }

  revalidatePath("/admin");
  return { ok: true };
}
