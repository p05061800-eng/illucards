"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Package, Trash2, XCircle } from "lucide-react";
import { DeliveryCountryField } from "@/app/components/DeliveryCountryField";
import { OrderLineRow } from "@/app/components/orders/OrderLineRow";
import { useAuth } from "@/app/context/AuthContext";
import { CART_STORAGE_KEY, useCart } from "@/app/context/CartContext";
import type { OrderListSummary } from "@/app/lib/ordersStore";
import { bonusBalanceDescriptionRu } from "@/app/lib/bonusProgram";
import {
  formatOrderCardRef,
  orderAccountFlowBadgeClass,
  orderAccountFlowKind,
  orderAccountFlowLabel,
  ruPositionCountPhrase,
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
import {
  displayCurrencyForDelivery,
  type DisplayCurrency,
  formatCardPrice,
  formatOrderTotalForDisplay,
  productPriceByCountry,
  rubFromByn,
} from "@/app/lib/formatPrice";
import { getTelegramOrderBotUsername } from "@/app/lib/telegramOrderBotUsername";
import { startTelegramWebLoginWithWait } from "@/app/lib/startTelegramWebLoginClient";
import { telegramWebLoginDeepLink } from "@/app/lib/telegramWebLoginUrl";

type LsGate = "pending" | "ok" | "no_telegram";

const PREVIEW_LIMIT = 5;
const TELEGRAM_CODE_VERIFY_URL =
  process.env.NEXT_PUBLIC_TELEGRAM_CODE_VERIFY_URL?.trim() ||
  "https://illucards-telegram-bot.onrender.com/api/verify-code";

const LS_DELIVERY_KEY = "illucards-delivery-country";

/** Корзина для verify-code: при автологине React ещё не подхватил localStorage — читаем сразу из LS. */
function readCartPayloadForVerifyFromStorage(): {
  cart: Array<{
    id: string;
    title: string;
    quantity: number;
    priceByn: number;
    priceRub: number;
  }>;
  deliveryCountry: DeliveryCountry;
} {
  const empty = {
    cart: [] as Array<{
      id: string;
      title: string;
      quantity: number;
      priceByn: number;
      priceRub: number;
    }>,
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
    const cart: Array<{
      id: string;
      title: string;
      quantity: number;
      priceByn: number;
      priceRub: number;
    }> = [];
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
      const priceRub =
        typeof o.priceRub === "number" && Number.isFinite(o.priceRub)
          ? Math.round(o.priceRub)
          : rubFromByn(priceByn);
      if (!id) continue;
      cart.push({ id, title, quantity, priceByn, priceRub });
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
    orderTotalByn,
    orderTotalRub,
    deliveryPriceByn,
    deliveryPriceRub,
    clearCart,
  } = useCart();
  const [accountPriceCurrency, setAccountPriceCurrency] = useState<DisplayCurrency>(
    displayCurrencyForDelivery(deliveryCountry),
  );
  const [lsGate, setLsGate] = useState<LsGate>("pending");
  const [orders, setOrders] = useState<OrderListSummary[] | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [bonusPointsBalance, setBonusPointsBalance] = useState(0);
  const [deleteOrderBusyId, setDeleteOrderBusyId] = useState<string | null>(null);
  const [cancelOrderBusyId, setCancelOrderBusyId] = useState<string | null>(null);
  const [orderLinesOpenById, setOrderLinesOpenById] = useState<Record<string, boolean>>({});
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
      const [ordersRes, stateRes] = await Promise.all([
        fetch("/api/orders/mine", { credentials: "include" }),
        fetch("/api/user-state", { method: "GET", credentials: "include", cache: "no-store" }),
      ]);
      if (ordersRes.status === 401) {
        setLsGate("no_telegram");
        setOrders([]);
        setBonusPointsBalance(0);
        return;
      }
      if (!ordersRes.ok) {
        setOrdersError("Не удалось загрузить заказы");
        setOrders([]);
        setBonusPointsBalance(0);
        return;
      }
      const data = (await ordersRes.json()) as { orders?: OrderListSummary[] };
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      let bp = 0;
      if (stateRes.ok) {
        const st = (await stateRes.json()) as { bonus_points?: unknown };
        if (typeof st.bonus_points === "number" && Number.isFinite(st.bonus_points)) {
          bp = Math.max(0, Math.floor(st.bonus_points));
        }
      }
      setBonusPointsBalance(bp);
    } catch {
      setOrdersError("Ошибка сети");
      setOrders([]);
      setBonusPointsBalance(0);
    }
  }, []);

  const handleCancelOrder = useCallback(
    async (orderId: string) => {
      if (deleteOrderBusyId || cancelOrderBusyId) return;
      const ok =
        typeof window !== "undefined"
          ? window.confirm(
              "Отменить заказ? Доступно только пока заказ в статусе «Новый» (ещё без подтверждения в Telegram).",
            )
          : true;
      if (!ok) return;
      setCancelOrderBusyId(orderId);
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
          setOrdersError(msg);
          return;
        }
        setOrdersError(null);
        await loadOrders();
      } catch {
        setOrdersError("Ошибка сети");
      } finally {
        setCancelOrderBusyId(null);
      }
    },
    [cancelOrderBusyId, deleteOrderBusyId, loadOrders],
  );

  const handleDeleteOrder = useCallback(
    async (orderId: string) => {
      if (deleteOrderBusyId || cancelOrderBusyId) return;
      const ok =
        typeof window !== "undefined"
          ? window.confirm(
              "Удалить заказ безвозвратно? Доступно только для заказов в статусе «Новый» (ещё без подтверждения в Telegram).",
            )
          : true;
      if (!ok) return;
      setDeleteOrderBusyId(orderId);
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
          setOrdersError(msg);
          return;
        }
        setOrdersError(null);
        await loadOrders();
      } catch {
        setOrdersError("Ошибка сети");
      } finally {
        setDeleteOrderBusyId(null);
      }
    },
    [cancelOrderBusyId, deleteOrderBusyId, loadOrders],
  );

  const isOrderLinesOpen = useCallback(
    (orderId: string, status: string) => {
      const v = orderLinesOpenById[orderId];
      if (v !== undefined) return v;
      return status === "new";
    },
    [orderLinesOpenById],
  );

  const toggleOrderLines = useCallback((orderId: string, status: string) => {
    setOrderLinesOpenById((prev) => {
      const cur = prev[orderId] ?? status === "new";
      return { ...prev, [orderId]: !cur };
    });
  }, []);

  useEffect(() => {
    if (lsGate !== "ok" || !hydrated) return;
    void loadOrders();
  }, [lsGate, hydrated, loadOrders]);

  useEffect(() => {
    setAccountPriceCurrency(displayCurrencyForDelivery(deliveryCountry));
  }, [deliveryCountry]);

  const handleOpenTelegramForLogin = useCallback(async () => {
    router.push("/account");
    router.refresh();
    const ok = await startTelegramWebLoginWithWait();
    if (!ok && typeof window !== "undefined") {
      window.open(telegramWebLoginDeepLink(), "_blank", "noopener,noreferrer");
    }
  }, [router]);

  const handleLogout = useCallback(async () => {
    await logout();
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
        ...(l.frontImage?.trim() ? { frontImage: l.frontImage.trim() } : {}),
        ...(l.category?.trim() ? { category: l.category.trim() } : {}),
        ...(l.rarity ? { rarity: l.rarity } : {}),
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
      clearCart();
      setPendingCartDismissed(true);
      void loadOrders();
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
    clearCart,
    loadOrders,
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
        priceRub: number;
      }> | null = null;
      let deliveryForVerify: DeliveryCountry = "BY";
      if (cartHydrated && cartItems.length > 0) {
        cartForVerify = cartItems.map((l) => ({
          id: l.id,
          title: l.title,
          quantity: l.quantity,
          priceByn: l.priceByn,
          priceRub: l.priceRub,
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
        verifyBody.currency = displayCurrencyForDelivery(deliveryForVerify);
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
      const uidFloor = Math.floor(userId);
      const established = establishSessionFromTelegramUserId(uidFloor, {
        telegramUsername: typeof data.username === "string" ? data.username : null,
      });
      if (!established.ok) {
        setTgError(established.error);
        return;
      }
      try {
        await fetch("/api/auth/telegram-cookie", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: uidFloor }),
        });
      } catch {
        /* cookie bridge optional; LS + JS cookie уже выставлены в establishSession */
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

      <div className="mt-6 rounded-2xl bg-zinc-50 p-5 text-zinc-900 shadow-[0_2px_12px_rgba(0,0,0,0.12)] ring-1 ring-zinc-200/90 sm:rounded-3xl sm:p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Бонусная программа
        </h2>
        <p className="mt-2 text-lg font-bold tabular-nums text-zinc-950">
          {orders === null
            ? "…"
            : `${bonusPointsBalance.toLocaleString("ru-RU")} баллов`}
        </p>
        {orders !== null ? (
          <p className="mt-1 text-sm text-zinc-600">{bonusBalanceDescriptionRu(bonusPointsBalance)}</p>
        ) : (
          <p className="mt-1 text-sm text-zinc-500">Загрузка…</p>
        )}
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          За каждую единицу товара в заказе — 100 баллов один раз после принятия заказа админом
          («Принят») или при «Отправлен» / «Доставлен». Списание в корзине: 100 баллов = 4 BYN (BY)
          или 100 RUB (другие страны), шаг 100.
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
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Валюта цен
            </span>
            <div className="inline-flex rounded-full border border-zinc-300 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setAccountPriceCurrency("BYN")}
                disabled={deliveryCountry != null && displayCurrencyForDelivery(deliveryCountry) !== "BYN"}
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                  accountPriceCurrency === "BYN"
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-500 hover:text-zinc-700"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                BYN
              </button>
              <button
                type="button"
                onClick={() => setAccountPriceCurrency("RUB")}
                disabled={deliveryCountry != null && displayCurrencyForDelivery(deliveryCountry) !== "RUB"}
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                  accountPriceCurrency === "RUB"
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-500 hover:text-zinc-700"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                RUB
              </button>
            </div>
          </div>
          <ul className="mt-4 space-y-2 border-t border-zinc-200/90 pt-4">
            {cartItems.map((l) => {
              const unit = productPriceByCountry(
                { priceByn: l.priceByn, priceRub: l.priceRub },
                accountPriceCurrency === "BYN" ? "BY" : "RU",
              );
              const line = unit * l.quantity;
              return (
                <li key={l.id}>
                  <OrderLineRow
                    line={{
                      id: l.id,
                      title: l.title,
                      quantity: l.quantity,
                      frontImage: l.frontImage,
                      category: l.category,
                      rarity: l.rarity,
                    }}
                    subtitle={
                      <>
                        {accountPriceCurrency === "BYN"
                          ? `${unit.toLocaleString("ru-RU", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            })} BYN`
                          : `${Math.round(unit).toLocaleString("ru-RU")} RUB`} × {l.quantity} ={" "}
                        {accountPriceCurrency === "BYN"
                          ? `${line.toLocaleString("ru-RU", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            })} BYN`
                          : `${Math.round(line).toLocaleString("ru-RU")} RUB`}
                      </>
                    }
                  />
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-base font-semibold text-zinc-900">
            Доставка: {DELIVERY_COUNTRY_LABELS[deliveryCountry ?? "BY"]} (
            {accountPriceCurrency === "BYN"
              ? formatCardPrice(deliveryPriceByn, "BYN")
              : formatCardPrice(deliveryPriceByn, "RUB", deliveryPriceRub)}
            )
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-zinc-950">
            Итого:{" "}
            {formatCardPrice(orderTotalByn, accountPriceCurrency, orderTotalRub)}
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
          <ul className="flex flex-col gap-3 sm:gap-4">
            {preview.map((o) => {
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
                  <article className="overflow-hidden rounded-2xl bg-zinc-50 text-zinc-900 shadow-[0_2px_10px_rgba(0,0,0,0.1)] ring-1 ring-zinc-200/90 transition hover:ring-zinc-300/90 sm:rounded-3xl">
                    <Link
                      href={`/account/orders/${encodeURIComponent(o.id)}`}
                      className="block px-4 pb-3 pt-4 sm:px-5 sm:pt-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                            Заказ № {ref}
                          </p>
                          <p className="mt-0.5 text-lg font-bold tabular-nums text-zinc-900">
                            {formatOrderTotalForDisplay(total, o.delivery)}
                          </p>
                        </div>
                        <span
                          className={`inline-flex max-w-[min(100%,11rem)] shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:max-w-none sm:px-3 sm:text-xs ${badgeClass}`}
                        >
                          {statusText}
                        </span>
                      </div>
                    </Link>
                    {o.status !== "new" && lines.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggleOrderLines(o.id, o.status)}
                        className="flex w-full items-center justify-between gap-2 border-t border-zinc-200/90 bg-zinc-100/70 px-4 py-2.5 text-left text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 sm:px-5"
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
                      <ul className="space-y-2 border-t border-zinc-200/90 bg-white/70 px-4 py-3 sm:px-5">
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
                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200/90 px-4 py-3 sm:px-5">
                      {o.status === "new" ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              void handleCancelOrder(o.id);
                            }}
                            disabled={
                              cancelOrderBusyId === o.id || deleteOrderBusyId === o.id
                            }
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-zinc-300/90 bg-white px-3 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
                            title="Отменить заказ (только до подтверждения в Telegram)"
                          >
                            <XCircle className="h-3.5 w-3.5" aria-hidden />
                            {cancelOrderBusyId === o.id ? "…" : "Отменить"}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              void handleDeleteOrder(o.id);
                            }}
                            disabled={
                              deleteOrderBusyId === o.id || cancelOrderBusyId === o.id
                            }
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-red-200/90 bg-red-50 px-3 text-xs font-semibold text-red-800 transition hover:bg-red-100 disabled:opacity-50"
                            title="Удалить заказ безвозвратно (только «Новый»)"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            {deleteOrderBusyId === o.id ? "…" : "Удалить"}
                          </button>
                        </>
                      ) : null}
                      <Link
                        href={`/account/orders/${encodeURIComponent(o.id)}`}
                        className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-violet-600 transition hover:text-violet-700"
                      >
                        Подробнее
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </div>
                  </article>
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
