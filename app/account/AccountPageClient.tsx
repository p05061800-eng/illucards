"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronRight, Package } from "lucide-react";
import { DeliveryCountryField } from "@/app/components/DeliveryCountryField";
import { useAuth } from "@/app/context/AuthContext";
import { CART_STORAGE_KEY, useCart } from "@/app/context/CartContext";
import type { OrderListSummary } from "@/app/lib/ordersStore";
import {
  formatOrderCardRef,
  orderAccountBadgeClass,
  orderAccountStatusLabel,
  orderAccountUiKind,
} from "@/app/lib/orderStatus";
import {
  readTelegramPrimaryUserId,
  readTelegramUserLink,
} from "@/app/lib/telegramUserIdentity";
import {
  deliveryCharge,
  DELIVERY_COUNTRY_LABELS,
  type DeliveryCountry,
} from "@/app/lib/delivery";
import { getTelegramOrderBotUsername } from "@/app/lib/telegramOrderBotUsername";
import { startTelegramWebLoginWithWait } from "@/app/lib/startTelegramWebLoginClient";
import { telegramWebLoginDeepLink } from "@/app/lib/telegramWebLoginUrl";

type LsGate = "pending" | "ok" | "no_telegram";

const PREVIEW_LIMIT = 5;
const TELEGRAM_CODE_VERIFY_URL =
  process.env.NEXT_PUBLIC_TELEGRAM_CODE_VERIFY_URL?.trim() ||
  "https://illucards-telegram-bot.onrender.com/api/verify-code";

function formatMoneyByn(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

const LS_DELIVERY_KEY = "illucards-delivery-country";

/** Корзина для verify-code: при автологине React ещё не подхватил localStorage — читаем сразу из LS. */
function readCartPayloadForVerifyFromStorage(): {
  cart: Array<{ id: string; title: string; quantity: number; priceByn: number }>;
  deliveryCountry: DeliveryCountry;
} {
  const empty = {
    cart: [] as Array<{ id: string; title: string; quantity: number; priceByn: number }>,
    deliveryCountry: "BY" as DeliveryCountry,
  };
  if (typeof window === "undefined") return empty;
  try {
    let dc: DeliveryCountry = "BY";
    const rd = localStorage.getItem(LS_DELIVERY_KEY);
    if (rd === "BY" || rd === "RU" || rd === "UA" || rd === "OTHER") {
      dc = rd;
    }
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return { ...empty, deliveryCountry: dc };
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return { ...empty, deliveryCountry: dc };
    const cart: Array<{ id: string; title: string; quantity: number; priceByn: number }> = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : "";
      const title = typeof o.title === "string" ? o.title : "";
      const q = typeof o.quantity === "number" ? o.quantity : Number(o.quantity);
      const quantity = Number.isFinite(q) && q >= 1 ? Math.floor(q) : 1;
      let priceByn = 0;
      if (typeof o.priceByn === "number" && Number.isFinite(o.priceByn)) {
        priceByn = o.priceByn;
      } else if (typeof o.price === "number" && Number.isFinite(o.price)) {
        priceByn = o.price;
      }
      if (!id) continue;
      cart.push({ id, title, quantity, priceByn });
    }
    return { cart, deliveryCountry: dc };
  } catch {
    return empty;
  }
}

export default function AccountPageClient() {
  const router = useRouter();
  const { user, hydrated, logout, establishSessionFromTelegramUserId } = useAuth();
  const {
    cartItems,
    hydrated: cartHydrated,
    deliveryCountry,
    setDeliveryCountry,
    totalPriceByn,
  } = useCart();
  const [lsGate, setLsGate] = useState<LsGate>("pending");
  const [orders, setOrders] = useState<OrderListSummary[] | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [tgCode, setTgCode] = useState("");
  const [tgInfo, setTgInfo] = useState<string | null>(null);
  const [tgError, setTgError] = useState<string | null>(null);
  const [verifyCodePending, setVerifyCodePending] = useState(false);
  const [pendingCartDismissed, setPendingCartDismissed] = useState(false);
  const [cartOrderBusy, setCartOrderBusy] = useState(false);
  const [cartOrderErr, setCartOrderErr] = useState<string | null>(null);
  const prevCodeDigitsLen = useRef(0);
  const verifyInFlight = useRef(false);
  const deliveryFieldId = useId();

  useEffect(() => {
    const id = readTelegramPrimaryUserId();
    if (id == null) {
      setLsGate("no_telegram");
      return;
    }
    setLsGate("ok");
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersError(null);
    try {
      const res = await fetch("/api/orders/mine", { credentials: "include" });
      if (res.status === 401) {
        setLsGate("no_telegram");
        setOrders([]);
        return;
      }
      if (!res.ok) {
        setOrdersError("Не удалось загрузить заказы");
        setOrders([]);
        return;
      }
      const data = (await res.json()) as { orders?: OrderListSummary[] };
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch {
      setOrdersError("Ошибка сети");
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    if (lsGate !== "ok" || !hydrated) return;
    void loadOrders();
  }, [lsGate, hydrated, loadOrders]);

  const handleOpenTelegramForLogin = useCallback(async () => {
    router.push("/account");
    router.refresh();
    const ok = await startTelegramWebLoginWithWait();
    if (!ok && typeof window !== "undefined") {
      window.open(telegramWebLoginDeepLink(), "_blank", "noopener,noreferrer");
    }
  }, [router]);

  const handleLogout = useCallback(() => {
    logout();
    setOrders([]);
    setLsGate("no_telegram");
    setPendingCartDismissed(false);
    router.push("/account");
    router.refresh();
  }, [logout, router]);

  const handleConfirmCartOrder = useCallback(async () => {
    if (!cartHydrated || cartItems.length === 0 || cartOrderBusy) return;
    const uid = readTelegramPrimaryUserId();
    if (uid == null) return;
    const dc: DeliveryCountry = deliveryCountry ?? "BY";
    const orderTotalByn =
      Math.round((totalPriceByn + deliveryCharge(dc).amountByn) * 100) / 100;
    setCartOrderErr(null);
    setCartOrderBusy(true);
    try {
      const items = cartItems.map((l) => ({
        id: l.id,
        title: l.title.trim(),
        quantity: l.quantity,
        priceByn: l.priceByn,
        priceRub: l.priceRub,
      }));
      const orderPayload: Record<string, unknown> = {
        items,
        total: orderTotalByn,
        delivery: dc,
        user_id: uid,
      };
      if (user?.telegramUsername) {
        orderPayload.username = user.telegramUsername;
      }
      const res = await fetch("/api/order/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });
      const data: unknown = await res.json().catch(() => null);
      const orderId =
        data &&
        typeof data === "object" &&
        "order_id" in data &&
        typeof (data as { order_id: unknown }).order_id === "string"
          ? (data as { order_id: string }).order_id.trim()
          : "";
      if (!res.ok || !orderId) {
        const msg =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Не удалось оформить заказ";
        setCartOrderErr(msg);
        setCartOrderBusy(false);
        return;
      }
      const bot = getTelegramOrderBotUsername();
      const startParam = `order_${orderId}`;
      if (typeof window !== "undefined") {
        window.location.assign(
          `https://t.me/${encodeURIComponent(bot)}?start=${encodeURIComponent(startParam)}`,
        );
      }
    } catch {
      setCartOrderErr("Сеть недоступна. Попробуйте ещё раз.");
      setCartOrderBusy(false);
    }
  }, [
    cartHydrated,
    cartItems,
    cartOrderBusy,
    deliveryCountry,
    totalPriceByn,
    user?.telegramUsername,
  ]);

  const handleVerifyTelegramCode = useCallback(async () => {
    const codeDigits = tgCode.replace(/\D/g, "").slice(0, 4);
    if (codeDigits.length !== 4) {
      setTgError("Введите 4 цифры кода");
      setTgInfo(null);
      return;
    }
    if (verifyInFlight.current) return;
    verifyInFlight.current = true;
    setVerifyCodePending(true);
    setTgError(null);
    setTgInfo(null);
    try {
      const verifyBody: Record<string, unknown> = { code: codeDigits };
      let cartForVerify: Array<{
        id: string;
        title: string;
        quantity: number;
        priceByn: number;
      }> | null = null;
      let deliveryForVerify: DeliveryCountry = "BY";
      if (cartHydrated && cartItems.length > 0) {
        cartForVerify = cartItems.map((l) => ({
          id: l.id,
          title: l.title,
          quantity: l.quantity,
          priceByn: l.priceByn,
        }));
        deliveryForVerify = deliveryCountry ?? "BY";
      } else {
        const snap = readCartPayloadForVerifyFromStorage();
        if (snap.cart.length > 0) {
          cartForVerify = snap.cart;
          deliveryForVerify = snap.deliveryCountry;
        }
      }
      if (cartForVerify && cartForVerify.length > 0) {
        verifyBody.cart = cartForVerify;
        verifyBody.deliveryCountry = deliveryForVerify;
      }
      const res = await fetch(TELEGRAM_CODE_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(verifyBody),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        user_id?: number;
        username?: string;
      };
      const userId = data.user_id;
      if (
        !res.ok ||
        typeof userId !== "number" ||
        !Number.isFinite(userId) ||
        userId <= 0
      ) {
        setTgError(data.error || "Неверный или просроченный код");
        return;
      }
      const established = establishSessionFromTelegramUserId(
        Math.floor(userId),
        {
          telegramUsername: typeof data.username === "string" ? data.username : null,
        },
      );
      if (!established.ok) {
        setTgError(established.error);
        return;
      }
      setTgInfo("Вход выполнен. Переход в личный кабинет…");
      setTgCode("");
      setLsGate("ok");
      if (typeof window !== "undefined") {
        window.location.assign("/account");
      } else {
        router.replace("/account");
        router.refresh();
      }
    } catch {
      setTgError("Ошибка сети. Попробуйте снова.");
    } finally {
      verifyInFlight.current = false;
      setVerifyCodePending(false);
    }
  }, [
    tgCode,
    establishSessionFromTelegramUserId,
    router,
    cartHydrated,
    cartItems,
    deliveryCountry,
  ]);

  /** После ввода 4-й цифры кода — сразу проверка и переход в ЛК (без лишнего клика). */
  useEffect(() => {
    const digits = tgCode.replace(/\D/g, "").slice(0, 4);
    const len = digits.length;
    if (len === 0) {
      prevCodeDigitsLen.current = 0;
      return;
    }
    if (
      len === 4 &&
      prevCodeDigitsLen.current < 4 &&
      !verifyCodePending &&
      lsGate === "no_telegram"
    ) {
      void handleVerifyTelegramCode();
    }
    prevCodeDigitsLen.current = len;
  }, [tgCode, verifyCodePending, lsGate, handleVerifyTelegramCode]);

  if (lsGate === "pending") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center text-sm text-zinc-500">
        Загрузка…
      </div>
    );
  }

  if (lsGate === "no_telegram") {
    return (
      <div
        className="mx-auto w-full max-w-2xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pt-6 md:max-w-3xl md:px-6"
        data-account-marketplace
      >
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">
          Личный кабинет
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Здесь будут профиль, заказы и статусы после входа через Telegram
        </p>

        <div className="mt-6 rounded-2xl bg-zinc-50 p-5 text-center text-zinc-900 shadow-[0_2px_12px_rgba(0,0,0,0.12)] ring-1 ring-zinc-200/90 sm:rounded-3xl sm:p-6">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200">
            <Package className="h-6 w-6" strokeWidth={1.5} aria-hidden />
          </div>
          <h2 className="text-lg font-bold tracking-tight text-zinc-950">
            Войдите, чтобы увидеть заказы
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-600">
            После авторизации через Telegram в кабинете появятся ваши заказы и
            текущие статусы доставки.
          </p>
          <button
            type="button"
            onClick={() => void handleOpenTelegramForLogin()}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#5D6BF3] px-6 text-sm font-semibold text-white shadow-md transition hover:brightness-110 sm:w-auto"
          >
            Войти через Telegram
          </button>
          <p className="mx-auto mt-2 max-w-md text-xs text-zinc-500">
            Когда код придёт в боте, эта вкладка сама откроет личный кабинет — оставьте сайт
            открытым.
          </p>
        </div>

        <div className="mt-4 rounded-2xl bg-zinc-50 p-5 text-zinc-900 shadow-[0_2px_12px_rgba(0,0,0,0.12)] ring-1 ring-zinc-200/90 sm:rounded-3xl sm:p-6">
          <h3 className="text-base font-bold tracking-tight text-zinc-950">
            Вход по коду из бота
          </h3>
          <p className="mt-1 text-sm text-zinc-600">
            Нажмите «Войти через Telegram», получите код в боте и введите 4 цифры.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Код из бота
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="0000"
                value={tgCode}
                onChange={(e) => setTgCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm tracking-[0.3em] text-zinc-900 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
              />
            </label>
            <button
              type="button"
              onClick={handleVerifyTelegramCode}
              disabled={verifyCodePending}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#5D6BF3] px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {verifyCodePending ? "Проверка..." : "Войти"}
            </button>
          </div>

          {tgError ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {tgError}
            </p>
          ) : null}
          {tgInfo ? (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {tgInfo}
            </p>
          ) : null}
        </div>

        <section className="mt-8" aria-labelledby="account-orders-heading">
          <h2
            id="account-orders-heading"
            className="text-lg font-semibold tracking-tight text-white sm:text-xl"
          >
            Заказы
          </h2>
          <div className="mt-3 rounded-2xl border border-dashed border-zinc-700/80 bg-zinc-900/40 px-5 py-10 text-center sm:px-6 sm:py-12">
            <p className="text-sm font-medium text-zinc-200">
              Заказы появятся после входа
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 sm:text-sm">
              Кабинет всегда доступен, а данные заказов привязываются к вашему
              Telegram ID.
            </p>
          </div>
        </section>
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center text-sm text-zinc-500">
        Загрузка…
      </div>
    );
  }

  const telegramId = readTelegramPrimaryUserId();
  if (telegramId == null) {
    return null;
  }

  const fromLs = readTelegramUserLink();
  const fromSession =
    user?.telegramId != null && user.telegramId === telegramId ? user : null;
  const rawUsername =
    fromSession?.telegramUsername?.trim() ||
    (fromLs?.user_id === telegramId ? fromLs.username : null) ||
    "";
  const username = rawUsername.replace(/^@/, "").trim();
  const showUsername = username.length > 0;

  const preview = orders === null ? [] : orders.slice(0, PREVIEW_LIMIT);
  const hasMore = orders !== null && orders.length > PREVIEW_LIMIT;

  return (
    <div
      className="mx-auto w-full max-w-2xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pt-6 md:max-w-3xl md:px-6"
      data-account-marketplace
    >
      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">
        Личный кабинет
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Профиль, заказы и статусы после входа через Telegram
      </p>

      <div className="mt-6 space-y-3 rounded-2xl bg-zinc-50 p-5 text-zinc-900 shadow-[0_2px_12px_rgba(0,0,0,0.12)] ring-1 ring-zinc-200/90 sm:rounded-3xl sm:p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Профиль
        </h2>
        <p className="text-sm text-zinc-600">
          <span className="text-zinc-500">Username:</span>{" "}
          {showUsername ? (
            <span className="font-medium text-zinc-900">@{username}</span>
          ) : (
            <span className="text-zinc-400">—</span>
          )}
        </p>
        <p className="text-sm text-zinc-600">
          <span className="text-zinc-500">Telegram ID:</span>{" "}
          <span className="font-mono font-medium tabular-nums text-zinc-900">
            {telegramId}
          </span>
        </p>
      </div>

      {cartHydrated &&
      cartItems.length > 0 &&
      !pendingCartDismissed ? (
        <section
          className="mt-8 overflow-hidden rounded-2xl bg-zinc-50 p-5 text-zinc-900 shadow-[0_2px_12px_rgba(0,0,0,0.12)] ring-1 ring-zinc-200/90 sm:rounded-3xl sm:p-6"
          aria-labelledby="account-cart-pending-heading"
        >
          <h2
            id="account-cart-pending-heading"
            className="text-lg font-semibold tracking-tight text-zinc-950 sm:text-xl"
          >
            Заказ из корзины
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Подтвердите состав — заказ уйдёт в обработку; откроется чат с ботом. Отмена скрывает
            этот блок (корзину на сайте не очищаем).
          </p>
          <div className="mt-4">
            <DeliveryCountryField
              id={deliveryFieldId}
              value={deliveryCountry}
              onChange={setDeliveryCountry}
              className="text-zinc-900"
            />
          </div>
          <ul className="mt-4 space-y-2 border-t border-zinc-200/90 pt-4">
            {cartItems.map((l) => {
              const line = l.priceByn * l.quantity;
              return (
                <li
                  key={l.id}
                  className="flex flex-wrap justify-between gap-2 text-sm text-zinc-800"
                >
                  <span className="min-w-0 flex-1 font-medium">
                    {l.title}
                    <span className="text-zinc-500"> ×{l.quantity}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatMoneyByn(line)} BYN
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-base font-semibold text-zinc-900">
            Доставка:{" "}
            {DELIVERY_COUNTRY_LABELS[deliveryCountry ?? "BY"]} (
            {formatMoneyByn(deliveryCharge(deliveryCountry ?? "BY").amountByn)} BYN
            {deliveryCountry && deliveryCountry !== "BY"
              ? ` / ${deliveryCharge(deliveryCountry).amountRub.toLocaleString("ru-RU")} RUB`
              : ""}
            )
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-zinc-950">
            Итого:{" "}
            {formatMoneyByn(
              Math.round(
                (totalPriceByn + deliveryCharge(deliveryCountry ?? "BY").amountByn) * 100,
              ) / 100,
            )}{" "}
            BYN
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void handleConfirmCartOrder()}
              disabled={cartOrderBusy}
              className="flex min-h-11 items-center justify-center rounded-xl bg-[#5D6BF3] px-4 text-sm font-semibold text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cartOrderBusy ? "Отправка…" : "Подтвердить заказ"}
            </button>
            <button
              type="button"
              onClick={() => setPendingCartDismissed(true)}
              disabled={cartOrderBusy}
              className="flex min-h-11 items-center justify-center rounded-xl border-2 border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Отмена
            </button>
          </div>
          {cartOrderErr ? (
            <p
              className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {cartOrderErr}
            </p>
          ) : null}
          <p className="mt-3 text-xs text-zinc-500">
            В Telegram после входа вам пришло то же сообщение с кнопками — можно подтвердить там.
          </p>
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="account-orders-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2
            id="account-orders-heading"
            className="text-lg font-semibold tracking-tight text-white sm:text-xl"
          >
            Заказы
          </h2>
          {orders !== null && orders.length > 0 ? (
            <Link
              href="/account/orders"
              className="inline-flex items-center gap-1 text-sm font-medium text-violet-300 transition hover:text-violet-200"
            >
              Все заказы
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </div>

        {orders === null ? (
          <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/30 px-4 py-10 text-center text-sm text-zinc-500">
            Загрузка заказов…
          </div>
        ) : ordersError ? (
          <div
            className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
            role="alert"
          >
            {ordersError}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700/80 bg-zinc-900/40 px-5 py-10 text-center sm:px-6 sm:py-12">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-500">
              <Package className="h-6 w-6" strokeWidth={1.5} aria-hidden />
            </div>
            <p className="text-sm font-medium text-zinc-200">Пока нет заказов</p>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 sm:text-sm">
              Оформите заказ на сайте — он появится здесь и в разделе «Все заказы».
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#5D6BF3] px-6 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
            >
              В каталог
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-2 sm:gap-3">
            {preview.map((o) => {
              const ref = formatOrderCardRef(o.id);
              const kind = orderAccountUiKind(o.status);
              const statusText = orderAccountStatusLabel(o.status);
              const badgeClass = orderAccountBadgeClass(kind);
              const total = Number.isFinite(o.total) ? o.total : 0;
              return (
                <li key={o.id}>
                  <Link
                    href={`/account/orders/${encodeURIComponent(o.id)}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-zinc-50 px-4 py-3.5 text-zinc-900 shadow-[0_2px_10px_rgba(0,0,0,0.1)] ring-1 ring-zinc-200/90 transition hover:ring-zinc-300/90 sm:rounded-3xl sm:px-5 sm:py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                        Заказ № {ref}
                      </p>
                      <p className="mt-0.5 text-lg font-bold tabular-nums text-zinc-900">
                        {formatMoneyByn(total)}{" "}
                        <span className="text-sm font-semibold text-zinc-500">
                          BYN
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`inline-flex max-w-[10rem] truncate rounded-full px-2.5 py-1 text-[11px] font-semibold sm:max-w-none sm:px-3 sm:text-xs ${badgeClass}`}
                      >
                        {statusText}
                      </span>
                      <ChevronRight
                        className="h-5 w-5 shrink-0 text-zinc-400"
                        aria-hidden
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore ? (
          <p className="mt-3 text-center text-xs text-zinc-500">
            Показаны последние {PREVIEW_LIMIT}.{" "}
            <Link
              href="/account/orders"
              className="font-medium text-violet-300 underline-offset-2 hover:underline"
            >
              Открыть полный список
            </Link>
          </p>
        ) : null}
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Link
          href="/account/orders"
          className="inline-flex min-h-[3.25rem] flex-1 items-center justify-center rounded-xl bg-[#5D6BF3] px-4 text-center text-base font-semibold text-white shadow-md shadow-indigo-900/25 transition hover:brightness-110 active:scale-[0.99] sm:min-h-14"
        >
          Все заказы
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex min-h-[3.25rem] flex-1 items-center justify-center rounded-xl border-2 border-zinc-600/80 bg-zinc-900/40 px-4 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60 active:scale-[0.99] sm:min-h-14"
        >
          Выйти
        </button>
      </div>
    </div>
  );
}
