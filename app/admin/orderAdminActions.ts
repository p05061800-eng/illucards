"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  getOrder,
  listRecentOrders,
  updateOrderStatus,
  type AdminOrderRow,
} from "@/app/lib/ordersStore";
import { notifyBotAwaitOrderDetails } from "@/app/lib/telegramCartBotSync";
import { sendOrderDetailsRequestToCustomer } from "@/app/lib/telegramOrderCustomerNotify";
import {
  ADMIN_SESSION_COOKIE,
  unsealAdminSession,
} from "@/app/lib/adminSession";

async function requireAdminAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const jar = await cookies();
  const session = unsealAdminSession(jar.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return { ok: false, error: "Нужна авторизация администратора" };
  }
  return { ok: true };
}

export async function loadAdminOrders(): Promise<AdminOrderRow[]> {
  const gate = await requireAdminAction();
  if (!gate.ok) return [];
  return listRecentOrders(50);
}

export async function purgeAllOrdersFromAdmin(): Promise<
  { ok: true; siteDeleted: number; botDeleted: number } | { ok: false; error: string }
> {
  const gate = await requireAdminAction();
  if (!gate.ok) return { ok: false, error: gate.error };
  return {
    ok: false,
    error: "Очистка заказов отключена — журнал заказов хранится всегда.",
  };
}

export async function confirmOrderFromAdmin(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;

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
