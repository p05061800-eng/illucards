"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Package } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import {
  formatOrderCardRef,
  orderAccountBadgeClass,
  orderAccountStatusLabel,
  orderAccountUiKind,
} from "@/app/lib/orderStatus";
import type { OrderStatus } from "@/app/lib/orderTypes";
import { readTelegramPrimaryUserId } from "@/app/lib/telegramUserIdentity";

type OrderRow = { id: string; total: number; status: OrderStatus };

type LsGate = "pending" | "ok" | "no_telegram";

function formatMoneyByn(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function AccountOrdersPageClient() {
  const router = useRouter();
  const { hydrated } = useAuth();
  const [lsGate, setLsGate] = useState<LsGate>("pending");
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const data = (await res.json()) as { orders?: OrderRow[] };
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch {
      setError("Ошибка сети");
      setOrders([]);
    }
  }, [router]);

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
            const kind = orderAccountUiKind(o.status);
            const statusText = orderAccountStatusLabel(o.status);
            const badgeClass = orderAccountBadgeClass(kind);
            const total = Number.isFinite(o.total) ? o.total : 0;
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
                      {formatMoneyByn(total)}
                      <span className="ml-1.5 text-base font-semibold text-zinc-500 sm:text-lg">
                        BYN
                      </span>
                    </p>
                  </div>

                  <div className="border-t border-zinc-200/90 bg-zinc-100/80 p-3 sm:p-4">
                    <Link
                      href={`/account/orders/${encodeURIComponent(o.id)}`}
                      className="group flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl bg-[#5D6BF3] px-4 text-base font-semibold text-white shadow-md shadow-indigo-900/25 transition hover:brightness-110 active:scale-[0.99] sm:min-h-14 sm:text-[1.05rem]"
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
