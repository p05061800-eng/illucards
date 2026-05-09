"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { OrderStatus } from "@/app/lib/orderTypes";
import { ChevronDown, ChevronRight, Package, Trash2, XCircle } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { OrderLineRow } from "@/app/components/orders/OrderLineRow";
import {
  formatOrderCardRef,
  orderAccountFlowBadgeClass,
  orderAccountFlowKind,
  orderAccountFlowLabel,
  ruPositionCountPhrase,
} from "@/app/lib/orderStatus";
import { formatOrderTotalForDisplay } from "@/app/lib/formatPrice";
import type { OrderListSummary } from "@/app/lib/ordersStore";
import { readTelegramPrimaryUserId } from "@/app/lib/telegramUserIdentity";

type LsGate = "pending" | "ok" | "no_telegram";

export default function AccountOrdersPageClient() {
  const router = useRouter();
  const { hydrated } = useAuth();
  const [lsGate, setLsGate] = useState<LsGate>("pending");
  const [orders, setOrders] = useState<OrderListSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [cancelBusyId, setCancelBusyId] = useState<string | null>(null);
  const [orderLinesOpenById, setOrderLinesOpenById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const id = readTelegramPrimaryUserId();
    if (id == null) {
      router.replace("/");
      setLsGate("no_telegram");
      return;
    }
    setLsGate("ok");
  }, [router]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/orders/mine", { credentials: "include" });
      if (res.status === 401) {
        router.replace("/");
        return;
      }
      if (!res.ok) {
        setError("Не удалось загрузить заказы");
        setOrders([]);
        return;
      }
      const data = (await res.json()) as { orders?: OrderListSummary[] };
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch {
      setError("Ошибка сети");
      setOrders([]);
    }
  }, [router]);

  const handleCancelOrder = useCallback(
    async (orderId: string) => {
      if (deleteBusyId || cancelBusyId) return;
      const ok =
        typeof window !== "undefined"
          ? window.confirm(
              "Отменить заказ? Доступно только пока заказ в статусе «Новый» (ещё без подтверждения в Telegram).",
            )
          : true;
      if (!ok) return;
      setCancelBusyId(orderId);
      setError(null);
      try {
        const res = await fetch("/api/order/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ order_id: orderId }),
        });
        const data: unknown = await res.json().catch(() => null);
        const msg =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Не удалось отменить заказ";
        if (!res.ok) {
          setError(msg);
          return;
        }
        await load();
      } catch {
        setError("Ошибка сети");
      } finally {
        setCancelBusyId(null);
      }
    },
    [cancelBusyId, deleteBusyId, load],
  );

  const handleDeleteOrder = useCallback(
    async (orderId: string) => {
      if (deleteBusyId || cancelBusyId) return;
      const ok =
        typeof window !== "undefined"
          ? window.confirm(
              "Удалить заказ безвозвратно? Только для статуса «Новый» (ещё без подтверждения в Telegram).",
            )
          : true;
      if (!ok) return;
      setDeleteBusyId(orderId);
      setError(null);
      try {
        const res = await fetch("/api/order/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ order_id: orderId }),
        });
        const data: unknown = await res.json().catch(() => null);
        const msg =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Не удалось удалить заказ";
        if (!res.ok) {
          setError(msg);
          return;
        }
        await load();
      } catch {
        setError("Ошибка сети");
      } finally {
        setDeleteBusyId(null);
      }
    },
    [cancelBusyId, deleteBusyId, load],
  );

  const isOrderLinesOpen = useCallback(
    (orderId: string, status: OrderStatus) => {
      const v = orderLinesOpenById[orderId];
      if (v !== undefined) return v;
      return status === "new";
    },
    [orderLinesOpenById],
  );

  const toggleOrderLines = useCallback((orderId: string, status: OrderStatus) => {
    setOrderLinesOpenById((prev) => {
      const cur = prev[orderId] ?? status === "new";
      return { ...prev, [orderId]: !cur };
    });
  }, []);

  useEffect(() => {
    if (lsGate !== "ok" || !hydrated) return;
    void load();
  }, [lsGate, hydrated, load]);

  if (lsGate === "pending") {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-2xl items-center justify-center px-4 py-20">
        <p className="text-sm text-zinc-500">Загрузка…</p>
      </div>
    );
  }

  if (lsGate === "no_telegram") {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-2xl items-center justify-center px-4 py-20">
        <p className="text-sm text-zinc-500">Переход на главную…</p>
      </div>
    );
  }

  if (!hydrated || orders === null) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-2xl items-center justify-center px-4 py-20">
        <p className="text-sm text-zinc-500">Загрузка…</p>
      </div>
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-2xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pt-6 md:max-w-3xl md:px-6"
      data-account-marketplace
    >
      <div className="mb-6 flex flex-col gap-1 sm:mb-8">
        <Link
          href="/account"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          <span aria-hidden>←</span> Личный кабинет
        </Link>
        <div className="mt-2 flex items-end justify-between gap-3">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-white sm:text-[1.75rem]">
            Мои заказы
          </h1>
          <span
            className="mb-0.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-300 sm:flex"
            aria-hidden
          >
            <Package className="h-5 w-5" strokeWidth={1.75} />
          </span>
        </div>
        <p className="text-sm text-zinc-500">История и статусы заказов</p>
      </div>

      {error ? (
        <div
          className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700/80 bg-zinc-900/40 px-6 py-12 text-center sm:px-8 sm:py-16">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-500">
            <Package className="h-8 w-8" strokeWidth={1.5} />
          </div>
          <p className="text-base font-medium text-zinc-200">Пока нет заказов</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Оформите заказ на сайте — он появится здесь автоматически.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-12 min-w-[200px] items-center justify-center rounded-xl bg-[#5D6BF3] px-8 text-base font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:brightness-110 active:scale-[0.99]"
          >
            В каталог
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-4 sm:gap-5">
          {orders.map((o) => {
            const ref = formatOrderCardRef(o.id);
            const flowKind = orderAccountFlowKind(o.status);
            const statusText = orderAccountFlowLabel(o.status);
            const badgeClass = orderAccountFlowBadgeClass(flowKind);
            const total = Number.isFinite(o.total) ? o.total : 0;
            const lines = Array.isArray(o.lines) ? o.lines : [];
            const lineCount =
              typeof o.lineCount === "number" && o.lineCount > 0
                ? o.lineCount
                : lines.length;
            const moreLines = lineCount > lines.length ? lineCount - lines.length : 0;
            return (
              <li key={o.id}>
                <article className="overflow-hidden rounded-2xl bg-zinc-50 text-zinc-900 shadow-[0_2px_12px_rgba(0,0,0,0.12)] ring-1 ring-zinc-200/90 transition hover:ring-zinc-300/90 sm:rounded-3xl">
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Заказ
                        </p>
                        <p className="mt-0.5 font-mono text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">
                          № {ref}
                        </p>
                      </div>
                      <span
                        className={`inline-flex max-w-full shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-semibold sm:px-3.5 sm:py-1.5 sm:text-[13px] ${badgeClass}`}
                      >
                        {statusText}
                      </span>
                    </div>

                    <p className="mt-5 text-2xl font-bold tabular-nums leading-none text-zinc-900 sm:text-3xl">
                      {formatOrderTotalForDisplay(total, o.delivery)}
                    </p>

                    {o.status !== "new" && lines.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggleOrderLines(o.id, o.status)}
                        className="mt-4 flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200/90 bg-zinc-100/80 px-3 py-2.5 text-left text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 sm:px-4"
                        aria-expanded={isOrderLinesOpen(o.id, o.status)}
                      >
                        <span>
                          {isOrderLinesOpen(o.id, o.status)
                            ? "Скрыть состав"
                            : `Показать состав · ${ruPositionCountPhrase(lineCount)}`}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${isOrderLinesOpen(o.id, o.status) ? "rotate-180" : ""}`}
                          aria-hidden
                        />
                      </button>
                    ) : null}
                    {lines.length > 0 && isOrderLinesOpen(o.id, o.status) ? (
                      <ul className="mt-3 space-y-2 border-t border-zinc-200/90 bg-white/70 py-4 pl-0 pr-0 pt-4">
                        {lines.map((l, idx) => (
                          <li key={`${o.id}-${idx}`}>
                            <OrderLineRow line={l} subtitle={`× ${l.quantity}`} />
                          </li>
                        ))}
                        {moreLines > 0 ? (
                          <li className="px-1 text-xs font-medium text-zinc-500">
                            и ещё {ruPositionCountPhrase(moreLines)}
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-zinc-200/90 bg-zinc-100/80 p-3 sm:flex-row sm:flex-wrap sm:gap-3 sm:p-4">
                    {o.status === "new" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleCancelOrder(o.id)}
                          disabled={cancelBusyId === o.id || deleteBusyId === o.id}
                          className="flex min-h-[3.25rem] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-zinc-400/90 bg-white px-4 text-base font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 active:scale-[0.99] disabled:opacity-50 sm:min-h-14"
                        >
                          <XCircle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                          {cancelBusyId === o.id ? "Отмена…" : "Отменить"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteOrder(o.id)}
                          disabled={deleteBusyId === o.id || cancelBusyId === o.id}
                          className="flex min-h-[3.25rem] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-red-200/90 bg-red-50 px-4 text-base font-semibold text-red-900 shadow-sm transition hover:bg-red-100 active:scale-[0.99] disabled:opacity-50 sm:min-h-14"
                        >
                          <Trash2 className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                          {deleteBusyId === o.id ? "Удаление…" : "Удалить"}
                        </button>
                      </>
                    ) : null}
                    <Link
                      href={`/account/orders/${encodeURIComponent(o.id)}`}
                      className="group flex min-h-[3.25rem] flex-1 items-center justify-center gap-2 rounded-xl bg-[#5D6BF3] px-4 text-base font-semibold text-white shadow-md shadow-indigo-900/25 transition hover:brightness-110 active:scale-[0.99] sm:min-h-14 sm:text-[1.05rem]"
                    >
                      Открыть заказ
                      <ChevronRight
                        className="h-5 w-5 opacity-90 transition group-hover:translate-x-0.5"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
