"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Package } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
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

export default function AccountPageClient() {
  const router = useRouter();
  const { user, hydrated, logout, establishSessionFromTelegramUserId } = useAuth();
  const [lsGate, setLsGate] = useState<LsGate>("pending");
  const [orders, setOrders] = useState<OrderListSummary[] | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [tgCode, setTgCode] = useState("");
  const [tgInfo, setTgInfo] = useState<string | null>(null);
  const [tgError, setTgError] = useState<string | null>(null);
  const [verifyCodePending, setVerifyCodePending] = useState(false);

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

  const handleLogout = useCallback(() => {
    logout();
    setOrders([]);
    setLsGate("no_telegram");
    router.push("/account");
    router.refresh();
  }, [logout, router]);

  const handleVerifyTelegramCode = useCallback(async () => {
    const codeDigits = tgCode.replace(/\D/g, "").slice(0, 4);
    if (codeDigits.length !== 4) {
      setTgError("Введите 4 цифры кода");
      setTgInfo(null);
      return;
    }
    setVerifyCodePending(true);
    setTgError(null);
    setTgInfo(null);
    try {
      const res = await fetch(TELEGRAM_CODE_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeDigits }),
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
      setTgInfo("Вход выполнен.");
      setTgCode("");
      setLsGate("ok");
      router.replace("/account");
      router.refresh();
    } catch {
      setTgError("Ошибка сети. Попробуйте снова.");
    } finally {
      setVerifyCodePending(false);
    }
  }, [tgCode, establishSessionFromTelegramUserId, router]);

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
          <a
            href={telegramWebLoginDeepLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#5D6BF3] px-6 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
          >
            Войти через Telegram
          </a>
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
