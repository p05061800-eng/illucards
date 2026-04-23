"use client";

import Link from "next/link";
import { Pencil, Percent } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { GuestEmailModal } from "@/components/checkout/GuestEmailModal";
import { useAuth, useCheckoutEmail } from "@/app/context/AuthContext";
import { useCart } from "@/app/context/CartContext";
import { useCurrency } from "@/app/context/CurrencyContext";
import { formatCardPrice } from "@/app/lib/formatPrice";
import {
  loadBeGatewayScript,
  pay,
} from "@/lib/bepaidCheckout";
import type { BePaidWidgetCloseStatus } from "@/types/begateway";

type PaymentMethod = "card" | "apple" | "erip";

function statusMessage(status: BePaidWidgetCloseStatus): {
  kind: "success" | "error" | "info";
  text: string;
} {
  switch (status) {
    case "successful":
      return {
        kind: "success",
        text: "Оплата прошла успешно. Спасибо за заказ!",
      };
    case "failed":
      return {
        kind: "error",
        text: "Платёж отклонён. Попробуйте другую карту или способ оплаты.",
      };
    case "pending":
      return {
        kind: "info",
        text: "Платёж обрабатывается. Статус придёт на почту.",
      };
    case "redirected":
      return {
        kind: "info",
        text: "Переход к способу оплаты. Завершите оплату во внешнем окне.",
      };
    case "error":
      return {
        kind: "error",
        text: "Ошибка виджета или сети. Попробуйте ещё раз позже.",
      };
    case null:
      return {
        kind: "info",
        text: "Окно оплаты закрыто.",
      };
    default:
      return { kind: "info", text: "Неизвестный статус." };
  }
}

export default function CheckoutPageClient() {
  const { cartItems, totalPriceByn, totalPriceRub, hydrated } = useCart();
  const { currency } = useCurrency();
  const { user, setGuestEmail } = useAuth();
  const checkoutEmail = useCheckoutEmail();

  const [method, setMethod] = useState<PaymentMethod>("card");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{
    kind: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const [checkoutStep, setCheckoutStep] = useState<"contact" | "payment">(
    "contact"
  );
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [promo, setPromo] = useState("");

  const amountMinor = useMemo(() => {
    const n = Number.isFinite(totalPriceByn) ? totalPriceByn : 0;
    return Math.max(1, Math.round(n * 100));
  }, [totalPriceByn]);

  const vatByn = useMemo(() => {
    const n = Number.isFinite(totalPriceByn) ? totalPriceByn : 0;
    return Math.round(n * 0.2 * 100) / 100;
  }, [totalPriceByn]);

  const vatRub = useMemo(() => {
    const n = Number.isFinite(totalPriceRub) ? totalPriceRub : 0;
    return Math.round(n * 0.2 * 100) / 100;
  }, [totalPriceRub]);

  const handlePay = useCallback(async () => {
    setBanner(null);
    if (cartItems.length === 0) {
      setBanner({
        kind: "error",
        text: "Корзина пуста — добавьте товары в каталоге.",
      });
      return;
    }
    if (!checkoutEmail) {
      setEmailModalOpen(true);
      return;
    }

    setLoading(true);
    try {
      await loadBeGatewayScript();
      const trackingId = `illu-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const methodLabel =
        method === "card"
          ? "карта"
          : method === "apple"
            ? "Apple/Google Pay"
            : "ЕРИП";
      const description = `IlluCards — заказ (${methodLabel})`;

      try {
        pay({
          amountMinor,
          currency: "BYN",
          description,
          trackingId,
          test: true,
          onClose: (status: BePaidWidgetCloseStatus) => {
            setLoading(false);
            setBanner(statusMessage(status));
          },
        });
      } catch (widgetErr) {
        setLoading(false);
        setBanner({
          kind: "error",
          text:
            widgetErr instanceof Error
              ? widgetErr.message
              : "Не удалось открыть виджет оплаты.",
        });
      }
    } catch (e) {
      setLoading(false);
      setBanner({
        kind: "error",
        text:
          e instanceof Error
            ? e.message
            : "Не удалось открыть оплату. Проверьте соединение.",
      });
    }
  }, [amountMinor, cartItems.length, method, checkoutEmail]);

  const handleContinue = useCallback(() => {
    if (!checkoutEmail) {
      setEmailModalOpen(true);
      return;
    }
    setCheckoutStep("payment");
    requestAnimationFrame(() => {
      document.getElementById("checkout-payment")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [checkoutEmail]);

  const onGuestEmailSubmit = useCallback(
    (email: string) => {
      setGuestEmail(email);
      setEmailModalOpen(false);
      setCheckoutStep("payment");
      requestAnimationFrame(() => {
        document.getElementById("checkout-payment")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    },
    [setGuestEmail]
  );

  if (!hydrated) {
    return (
      <p className="text-center text-sm text-zinc-500">Загрузка…</p>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-white/[0.08] bg-zinc-950/60 p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-md">
        <p className="text-zinc-400">В корзине пока ничего нет.</p>
        <Link
          href="/#collection"
          className="mt-6 inline-flex rounded-full border border-violet-500/35 bg-violet-950/40 px-8 py-3 text-sm font-medium text-violet-100 transition hover:border-violet-400/50"
        >
          В каталог
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      <GuestEmailModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        onSubmit={onGuestEmailSubmit}
      />

      <h1 className="mb-2 text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        оформление заказа
      </h1>
      <p className="mb-10 text-center text-sm text-zinc-500">
        Бонусы, email и оплата через bePaid
      </p>

      {banner ? (
        <div
          role="status"
          className={`mb-8 rounded-2xl border px-4 py-3 text-sm ${
            banner.kind === "success"
              ? "border-emerald-500/35 bg-emerald-950/40 text-emerald-100"
              : banner.kind === "error"
                ? "border-red-500/35 bg-red-950/35 text-red-100"
                : "border-zinc-600/40 bg-zinc-900/50 text-zinc-300"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_min(380px,100%)] lg:items-start">
        <div className="space-y-6">
          {/* Бонусы и скидки */}
          <section className="overflow-hidden rounded-2xl bg-[#5D6BF3] p-6 text-white shadow-[0_16px_48px_rgba(93,107,243,0.35)] sm:p-8">
            <h2 className="text-lg font-semibold sm:text-xl">
              Накапливайте бонусы и получайте скидки с первой покупки
            </h2>
            <p className="mt-2 max-w-xl text-sm text-white/85">
              Зарегистрируйтесь в личном кабинете — мы начислим бонусные баллы
              за покупки (демо).
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/login?next=/checkout"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#5D6BF3] transition hover:bg-white/95"
              >
                Войти или зарегистрироваться
                <span aria-hidden>→</span>
              </Link>
              {!user ? (
                <span className="self-center text-xs text-white/70">
                  или укажите email справа как гость
                </span>
              ) : null}
            </div>
          </section>

          {/* Промокод */}
          <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/50 p-5 sm:p-6">
            <h2 className="text-sm font-medium text-white">{`Использовать промокод`}</h2>
            <div className="mt-4 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Percent
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden
                />
                <input
                  type="text"
                  value={promo}
                  onChange={(e) => setPromo(e.target.value)}
                  placeholder="Введите промокод здесь"
                  className="w-full rounded-xl border border-white/10 bg-black/35 py-3 pl-10 pr-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#5D6BF3]/45 focus:outline-none focus:ring-2 focus:ring-[#5D6BF3]/20"
                />
              </div>
              <button
                type="button"
                className="shrink-0 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
              >
                OK
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-600">
              В демо промокоды не применяются к сумме.
            </p>
          </section>

          {/* Оплата — после шага «Продолжить» */}
          {checkoutStep === "payment" ? (
            <section
              id="checkout-payment"
              className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:p-8"
            >
              <h2 className="text-lg font-semibold tracking-tight text-white">
                Оплата
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Выберите способ — виджет откроется на этой странице
              </p>

              <fieldset className="mt-8 space-y-3">
                <legend className="sr-only">Способ оплаты</legend>

                {(
                  [
                    {
                      id: "card" as const,
                      title: "Банковская карта",
                      hint: "Visa, Mastercard, МИР",
                    },
                    {
                      id: "apple" as const,
                      title: "Apple Pay / Google Pay",
                      hint: "Где доступно в виджете",
                    },
                    {
                      id: "erip" as const,
                      title: "ЕРИП и другие",
                      hint: "Счёт или альтернативные методы в виджете",
                    },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition ${
                      method === opt.id
                        ? "border-[#5D6BF3]/50 bg-[#5D6BF3]/10 shadow-[0_0_0_1px_rgba(93,107,243,0.25)]"
                        : "border-white/[0.06] bg-black/20 hover:border-white/12"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pay-method"
                      value={opt.id}
                      checked={method === opt.id}
                      onChange={() => setMethod(opt.id)}
                      className="mt-1 h-4 w-4 shrink-0 border-zinc-600 bg-zinc-900 text-[#5D6BF3] focus:ring-[#5D6BF3]/40"
                    />
                    <span>
                      <span className="block font-medium text-zinc-100">
                        {opt.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        {opt.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <button
                type="button"
                onClick={() => void handlePay()}
                disabled={loading || !checkoutEmail}
                className="mt-10 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#5D6BF3] py-4 text-sm font-semibold text-white shadow-[0_12px_40px_rgba(93,107,243,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Открываем оплату…" : "Оплатить"}
                {!loading ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                    →
                  </span>
                ) : null}
              </button>
            </section>
          ) : (
            <p className="rounded-2xl border border-dashed border-white/10 bg-zinc-950/40 px-4 py-6 text-center text-sm text-zinc-500">
              Укажите email справа и нажмите «Продолжить», чтобы перейти к
              оплате.
            </p>
          )}
        </div>

        <aside className="lg:sticky lg:top-28">
          <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-zinc-900/50 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.4)] sm:p-6">
            <h2 className="text-sm font-medium text-white">
              Мы отправим подтверждение на ваш email
            </h2>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/25 px-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-200">
                  {checkoutEmail || "Не указан"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEmailModalOpen(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-white/10"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Изменить
              </button>
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="flex justify-between text-sm text-zinc-400">
                <span>Всего</span>
                <span className="tabular-nums text-zinc-200">
                  {formatCardPrice(
                    totalPriceByn,
                    currency,
                    currency === "RUB" ? totalPriceRub : undefined
                  )}
                </span>
              </div>
              <div className="mt-2 flex justify-between text-sm text-zinc-500">
                <span>В т.ч. НДС (условно)</span>
                <span className="tabular-nums">
                  {formatCardPrice(
                    vatByn,
                    currency,
                    currency === "RUB" ? vatRub : undefined
                  )}
                </span>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <span className="text-sm text-zinc-500">Итого к оплате</span>
                <span className="text-xl font-semibold tabular-nums tracking-tight text-white">
                  {formatCardPrice(
                    totalPriceByn,
                    currency,
                    currency === "RUB" ? totalPriceRub : undefined
                  )}
                </span>
              </div>
              {user ? (
                <p className="mt-3 text-xs text-zinc-500">
                  За эту покупку начислим бонусные баллы на ваш аккаунт (демо).
                </p>
              ) : (
                <p className="mt-3 text-xs text-zinc-500">
                  Войдите в кабинет, чтобы копить бонусы за покупки.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleContinue}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#5D6BF3] py-3.5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Продолжить
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                →
              </span>
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/20 p-4 text-xs leading-relaxed text-zinc-600">
            Тестовый режим bePaid. Для боя задайте{" "}
            <code className="rounded bg-black/40 px-1 text-zinc-400">
              NEXT_PUBLIC_BEPAID_PUBLIC_KEY
            </code>{" "}
            в .env
          </div>
        </aside>
      </div>
    </div>
  );
}
