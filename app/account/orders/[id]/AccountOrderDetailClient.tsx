"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, RefreshCw, Trash2, XCircle } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { useCart } from "@/app/context/CartContext";
import { DELIVERY_COUNTRY_LABELS, type DeliveryCountry } from "@/app/lib/delivery";
import { OrderLineRow } from "@/app/components/orders/OrderLineRow";
import { parseCardRarity } from "@/app/lib/cardRarityTags";
import {
  type DisplayCurrency,
  formatCardPrice,
  formatOrderTotalForDisplay,
  rubFromByn,
} from "@/app/lib/formatPrice";
import {
  formatOrderCardRef,
  orderAccountFlowBadgeClass,
  orderAccountFlowKind,
  orderAccountFlowLabel,
  orderStatusFromStorage,
} from "@/app/lib/orderStatus";
import { TELEGRAM_ORDER_BOT_DEFAULT } from "@/app/lib/telegramOrderCheckout";
import { readTelegramPrimaryUserId } from "@/app/lib/telegramUserIdentity";

type OrderLineApi = {
  id?: string;
  title: string;
  quantity?: number;
  priceByn?: number;
  priceRub?: number;
  frontImage?: string;
  category?: string;
  rarity?: string;
};

type OrderApi = {
  user_id?: number;
  items?: OrderLineApi[];
  total?: number;
  delivery?: string;
  deliveryCountry?: string;
  status?: string;
};

type LsGate = "pending" | "ok" | "no_telegram";

type LoadState = "idle" | "loading" | "notfound" | "ok";

/** Deep link: https://t.me/<bot>?start=support_<order_id> */
function supportTelegramHref(orderId: string): string {
  const raw =
    process.env.NEXT_PUBLIC_TELEGRAM_ORDER_BOT_USERNAME ||
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ||
    "";
  const name = (raw || TELEGRAM_ORDER_BOT_DEFAULT).replace(/^@/, "").trim();
  const start = `support_${orderId}`;
  return `https://t.me/${name}?start=${encodeURIComponent(start)}`;
}

/** Deep link заказа: в боте откроется карточка заказа с кнопками "Подтвердить/Отмена". */
function orderTelegramHref(orderId: string): string {
  const raw =
    process.env.NEXT_PUBLIC_TELEGRAM_ORDER_BOT_USERNAME ||
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ||
    "";
  const name = (raw || TELEGRAM_ORDER_BOT_DEFAULT).replace(/^@/, "").trim();
  const start = `order_${orderId}`;
  return `https://t.me/${name}?start=${encodeURIComponent(start)}`;
}

/** Deep link в раздел заказов бота: для уже подтверждённых заказов не открываем сценарий подтверждения. */
function telegramMyOrdersHref(): string {
  const raw =
    process.env.NEXT_PUBLIC_TELEGRAM_ORDER_BOT_USERNAME ||
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ||
    "";
  const name = (raw || TELEGRAM_ORDER_BOT_DEFAULT).replace(/^@/, "").trim();
  return `https://t.me/${name}?start=${encodeURIComponent("my_orders")}`;
}

function parseOrderDelivery(o: OrderApi): DeliveryCountry | null {
  const d = o.delivery ?? o.deliveryCountry;
  if (d === "BY" || d === "RU" || d === "UA" || d === "OTHER") {
    return d;
  }
  return null;
}

export default function AccountOrderDetailClient({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { hydrated } = useAuth();
  const { repeatOrderToCart } = useCart();
  const [lsGate, setLsGate] = useState<LsGate>("pending");
  const [load, setLoad] = useState<LoadState>("idle");
  const [order, setOrder] = useState<OrderApi | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelErr, setCancelErr] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  useEffect(() => {
    const id = readTelegramPrimaryUserId();
    if (id == null) {
      router.replace("/");
      setLsGate("no_telegram");
      return;
    }
    setLsGate("ok");
  }, [router]);

  useEffect(() => {
    if (lsGate !== "ok" || !hydrated) return;
    const myId = readTelegramPrimaryUserId();
    if (myId == null) return;

    setLoad("loading");
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/order/${encodeURIComponent(orderId)}`, {
          credentials: "include",
        });
        if (cancelled) return;
        if (!res.ok) {
          setLoad("notfound");
          return;
        }
        const data = (await res.json()) as OrderApi;
        if (cancelled) return;
        const uid = data.user_id;
        if (uid == null || Math.floor(uid) !== myId) {
          router.replace("/");
          return;
        }
        setOrder(data);
        setLoad("ok");
      } catch {
        if (!cancelled) setLoad("notfound");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lsGate, hydrated, orderId, router]);

  const reloadOrder = useCallback(async () => {
    const myId = readTelegramPrimaryUserId();
    if (myId == null) return;
    try {
      const res = await fetch(`/api/order/${encodeURIComponent(orderId)}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as OrderApi;
      const uid = data.user_id;
      if (uid == null || Math.floor(uid) !== myId) return;
      setOrder(data);
    } catch {
      /* ignore */
    }
  }, [orderId]);

  const handleDeleteOrder = useCallback(async () => {
    if (deleteBusy) return;
    const ok =
      typeof window !== "undefined"
        ? window.confirm(
            "Удалить заказ безвозвратно? Доступно только пока статус «Новый» (ещё без подтверждения в Telegram).",
          )
        : true;
    if (!ok) return;
    setDeleteErr(null);
    setDeleteBusy(true);
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
        setDeleteErr(msg);
        setDeleteBusy(false);
        return;
      }
      router.replace("/account/orders");
      router.refresh();
    } catch {
      setDeleteErr("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteBusy, orderId, router]);

  const handleCancelOrder = useCallback(async () => {
    if (cancelBusy) return;
    const ok =
      typeof window !== "undefined"
        ? window.confirm(
            "Отменить заказ? Доступно только пока вы ещё не подтвердили заказ в Telegram. После подтверждения отмена с сайта недоступна.",
          )
        : true;
    if (!ok) return;
    setCancelErr(null);
    setCancelBusy(true);
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
        setCancelErr(msg);
        setCancelBusy(false);
        return;
      }
      await reloadOrder();
    } catch {
      setCancelErr("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setCancelBusy(false);
    }
  }, [cancelBusy, orderId, reloadOrder]);

  const handleRepeat = useCallback(() => {
    if (!order) return;
    const raw = Array.isArray(order.items) ? order.items : [];
    const lines = raw.map((it, i) => {
      const id = (typeof it.id === "string" && it.id.trim()) || `repeat-${orderId}-${i}`;
      const priceByn = Number.isFinite(Number(it.priceByn)) ? Number(it.priceByn) : 0;
      const priceRubRaw = Number(it.priceRub);
      const priceRub = Number.isFinite(priceRubRaw) ? priceRubRaw : rubFromByn(priceByn);
      return {
        id,
        title: typeof it.title === "string" ? it.title : "—",
        quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
        priceByn,
        priceRub,
        ...(typeof it.frontImage === "string" && it.frontImage.trim()
          ? { frontImage: it.frontImage.trim() }
          : {}),
        ...(typeof it.category === "string" && it.category.trim()
          ? { category: it.category.trim() }
          : {}),
        ...(typeof it.rarity === "string" && it.rarity.trim()
          ? { rarity: it.rarity.trim() }
          : {}),
      };
    });
    const dc = parseOrderDelivery(order);
    repeatOrderToCart(lines, {
      deliveryCountry: dc,
      openCart: false,
    });
    // Следующий macrotask: после commit корзины в React
    setTimeout(() => {
      router.push("/checkout");
    }, 0);
  }, [order, orderId, repeatOrderToCart, router]);

  const supportHref = useMemo(() => supportTelegramHref(orderId), [orderId]);
  const orderHref = useMemo(() => orderTelegramHref(orderId), [orderId]);
  const myOrdersHref = useMemo(() => telegramMyOrdersHref(), []);

  if (lsGate === "pending" || (lsGate === "ok" && !hydrated)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center text-sm text-zinc-500">
        Загрузка…
      </div>
    );
  }

  if (lsGate === "no_telegram") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center text-sm text-zinc-500">
        Переход на главную…
      </div>
    );
  }

  if (load === "loading" || load === "idle") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center text-sm text-zinc-500">
        Загрузка…
      </div>
    );
  }

  if (load === "notfound" || !order) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-5 md:max-w-3xl">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-6 py-10 sm:py-12">
          <p className="text-base font-medium text-zinc-300">Заказ не найден</p>
          <Link
            href="/account/orders"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#5D6BF3] px-8 text-base font-semibold text-white"
          >
            К списку заказов
          </Link>
        </div>
      </div>
    );
  }

  const ref = formatOrderCardRef(orderId);
  const st = orderStatusFromStorage(order.status);
  const canCancelOnSite = st === "new";
  const canDeleteOnSite = st === "new";
  const flowKind = orderAccountFlowKind(st);
  const statusText = orderAccountFlowLabel(st);
  const badgeClass = orderAccountFlowBadgeClass(flowKind);
  const items = Array.isArray(order.items) ? order.items : [];
  const delivery = parseOrderDelivery(order);
  const deliveryText = delivery
    ? DELIVERY_COUNTRY_LABELS[delivery]
    : "—";
  const total =
    typeof order.total === "number" && Number.isFinite(order.total) ? order.total : null;
  const priceCurrency: DisplayCurrency =
    delivery && delivery !== "BY" ? "RUB" : "BYN";

  return (
    <div
      className="mx-auto w-full max-w-2xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pt-6 md:max-w-3xl md:px-6"
      data-account-marketplace
    >
      <div className="mb-6 sm:mb-8">
        <Link
          href="/account/orders"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          <span aria-hidden>←</span> Мои заказы
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl bg-zinc-50 text-zinc-900 shadow-[0_2px_12px_rgba(0,0,0,0.12)] ring-1 ring-zinc-200/90 sm:rounded-3xl">
        <div className="border-b border-zinc-200/90 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Заказ
              </h1>
              <p className="mt-0.5 font-mono text-2xl font-bold tracking-tight sm:text-3xl">
                № {ref}
              </p>
              <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-zinc-500 sm:text-xs">
                {orderId}
              </p>
            </div>
            <span
              className={`inline-flex max-w-full shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-semibold sm:px-3.5 sm:text-[13px] ${badgeClass}`}
            >
              {statusText}
            </span>
          </div>
        </div>

        <div className="space-y-1 border-b border-zinc-200/90 bg-white px-5 py-5 sm:px-6 sm:py-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Товары
          </h2>
          {items.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">—</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {items.map((it, i) => {
                const q = Math.max(1, Math.floor(Number(it.quantity) || 1));
                const p = Number.isFinite(Number(it.priceByn)) ? Number(it.priceByn) : 0;
                const lineTotal = p * q;
                const prRaw = Number(it.priceRub);
                const unitRub = Number.isFinite(prRaw)
                  ? prRaw
                  : rubFromByn(p);
                const id =
                  typeof it.id === "string" && it.id.trim() ? it.id.trim() : "";
                const title = typeof it.title === "string" ? it.title : "—";
                const rarityParsed =
                  typeof it.rarity === "string" && it.rarity.trim()
                    ? parseCardRarity(it.rarity)
                    : undefined;
                return (
                  <li key={it.id || String(i)}>
                    <OrderLineRow
                      line={{
                        id,
                        title,
                        quantity: q,
                        frontImage:
                          typeof it.frontImage === "string" ? it.frontImage : undefined,
                        category:
                          typeof it.category === "string" ? it.category : undefined,
                        rarity: rarityParsed,
                      }}
                      subtitle={`${formatCardPrice(p, priceCurrency, unitRub)} × ${q}`}
                      trailing={
                        <>{formatCardPrice(lineTotal, priceCurrency, unitRub * q)}</>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="grid gap-0 border-b border-zinc-200/90 sm:grid-cols-2 sm:divide-x sm:divide-zinc-200/80">
          <div className="bg-zinc-50/90 px-5 py-4 sm:px-6 sm:py-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Доставка
            </h2>
            <p className="mt-2 text-base font-medium text-zinc-900">{deliveryText}</p>
          </div>
          <div className="bg-zinc-50/90 px-5 py-4 sm:px-6 sm:py-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Сумма
            </h2>
            <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 sm:text-3xl">
              {total != null ? formatOrderTotalForDisplay(total, delivery) : "—"}
            </p>
          </div>
        </div>

        <div className="space-y-3 bg-zinc-100/80 p-3 sm:space-y-3 sm:p-4">
          {deleteErr ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {deleteErr}
            </p>
          ) : null}
          {cancelErr ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {cancelErr}
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            {st === "new" ? (
              <a
                href={orderHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[3.25rem] w-full items-center justify-center rounded-xl bg-[#5D6BF3] px-4 text-base font-semibold text-white shadow-md shadow-indigo-900/20 transition hover:brightness-110 active:scale-[0.99] sm:min-h-14"
              >
                Подтвердить в Telegram
              </a>
            ) : (
              <a
                href={myOrdersHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[3.25rem] w-full items-center justify-center rounded-xl bg-[#5D6BF3] px-4 text-base font-semibold text-white shadow-md shadow-indigo-900/20 transition hover:brightness-110 active:scale-[0.99] sm:min-h-14"
              >
                Открыть в Telegram
              </a>
            )}
            {canCancelOnSite ? (
              <button
                type="button"
                onClick={() => void handleCancelOrder()}
                disabled={cancelBusy}
                className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl border-2 border-zinc-400/90 bg-white px-4 text-base font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-14"
              >
                <XCircle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                {cancelBusy ? "Отмена…" : "Отменить заказ"}
              </button>
            ) : null}
          </div>
          {!canCancelOnSite && st !== "cancelled" ? (
            <p className="rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-center text-xs text-zinc-600">
              Заказ уже в сборке — отменить с сайта нельзя. При необходимости напишите в поддержку.
            </p>
          ) : null}
          <a
            href={supportHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl border-2 border-zinc-300/90 bg-white px-4 text-base font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 active:scale-[0.99] sm:min-h-14"
          >
            <MessageCircle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            Написать в поддержку
          </a>
          {canDeleteOnSite ? (
            <button
              type="button"
              onClick={() => void handleDeleteOrder()}
              disabled={deleteBusy}
              className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl border-2 border-red-300/90 bg-red-50 px-4 text-base font-semibold text-red-900 shadow-sm transition hover:bg-red-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-14"
            >
              <Trash2 className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              {deleteBusy ? "Удаление…" : "Удалить заказ"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleRepeat}
            disabled={items.length === 0}
            className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl bg-[#5D6BF3] px-4 text-base font-semibold text-white shadow-md shadow-indigo-900/20 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-14 sm:text-[1.05rem]"
          >
            <RefreshCw className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            Повторить заказ
          </button>
        </div>
      </div>
    </div>
  );
}
