"use client";

import { useCallback, useState, useTransition } from "react";
import type { AdminOrderRow } from "@/app/lib/ordersStore";
import { formatOrderCardRef } from "@/app/lib/orderStatus";
import { orderPaymentMethodLabel } from "@/app/lib/orderPayment";
import { orderStatusLabelRu } from "@/app/lib/orderStatus";
import { confirmOrderFromAdmin, loadAdminOrders } from "./orderAdminActions";

function formatAdminOrderMeta(row: AdminOrderRow): string {
  const parts = [
    orderStatusLabelRu(row.status),
    row.payment_method
      ? orderPaymentMethodLabel(row.payment_method)
      : "оплата не выбрана",
  ];
  if (row.user_id) parts.push(`tg ${row.user_id}`);
  if (row.username) parts.push(`@${row.username}`);
  return parts.join(" · ");
}

type Props = {
  initialOrders: AdminOrderRow[];
};

export function AdminOrdersPanel({ initialOrders }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const rows = await loadAdminOrders();
      setOrders(rows);
    });
  }, []);

  const onConfirm = useCallback((orderId: string) => {
    const row = orders.find((r) => r.id === orderId);
    const ref = row?.displayRef || formatOrderCardRef(orderId);
    if (!window.confirm(`Подтвердить заказ #${ref}?`)) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await confirmOrderFromAdmin(orderId);
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setMessage("Заказ подтверждён. Покупателю отправлен запрос данных в Telegram.");
      const rows = await loadAdminOrders();
      setOrders(rows);
    });
  }, [orders]);

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/40 px-6 py-16 text-center backdrop-blur-sm">
        <p className="font-medium text-zinc-400">Заказов пока нет</p>
        <p className="mt-2 text-sm text-zinc-600">
          После оформления на сайте заказы появятся здесь.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          Подтверждайте заказ после выбора способа оплаты в Telegram — покупателю
          уйдёт запрос на данные доставки.
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={pending}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10 disabled:opacity-50"
        >
          Обновить
        </button>
      </div>
      {message ? (
        <p className="rounded-xl border border-violet-500/30 bg-violet-950/30 px-4 py-3 text-sm text-violet-100">
          {message}
        </p>
      ) : null}
      <ul className="space-y-3">
        {orders.map((row) => {
          const canConfirm =
            row.status === "new" && Boolean(row.payment_method);
          return (
            <li
              key={row.id}
              className="flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-950/50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium text-zinc-100">
                  Заказ #{row.displayRef || formatOrderCardRef(row.id)}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  {formatAdminOrderMeta(row)} · {row.total} BYN
                </p>
              </div>
              {canConfirm ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onConfirm(row.id)}
                  className="shrink-0 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Подтвердить заказ
                </button>
              ) : (
                <span className="text-xs text-zinc-600">
                  {row.status === "confirmed"
                    ? "Подтверждён"
                    : row.status === "cancelled"
                      ? "Отменён"
                      : "Ждём выбор оплаты в боте"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
