"use client";

import { useCallback, useState } from "react";
import { useCart } from "@/app/context/CartContext";
import { TELEGRAM_ORDER_BOT_DEFAULT } from "@/app/lib/telegramOrderCheckout";

type Props = {
  className?: string;
  onBeforeNavigate?: () => void;
};

function resolveBotUsername(): string {
  if (typeof document !== "undefined") {
    const fromDom =
      document.documentElement.getAttribute("data-telegram-order-bot") ||
      document.documentElement.getAttribute("data-telegram-bot-username");
    const trimmed = (fromDom ?? "").replace(/^@/, "").trim();
    if (trimmed) return trimmed;
  }
  const fromEnv =
    process.env.NEXT_PUBLIC_TELEGRAM_ORDER_BOT_USERNAME ||
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ||
    "";
  const fromEnvTrim = fromEnv.replace(/^@/, "").trim();
  return fromEnvTrim || TELEGRAM_ORDER_BOT_DEFAULT;
}

export function TelegramCheckoutButton({
  className = "",
  onBeforeNavigate,
}: Props) {
  const { cartItems, hydrated, deliveryCountry } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = useCallback(async () => {
    if (!hydrated || cartItems.length === 0 || !deliveryCountry || submitting) {
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const items = cartItems.map((l) => ({
        id: l.id,
        title: l.title.trim(),
        quantity: l.quantity,
        priceByn: l.priceByn,
        priceRub: l.priceRub,
      }));

      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryCountry, items }),
      });

      const data: unknown = await res.json().catch(() => null);
      const orderId =
        data &&
        typeof data === "object" &&
        "orderId" in data &&
        typeof (data as { orderId: unknown }).orderId === "string"
          ? (data as { orderId: string }).orderId.trim()
          : "";

      if (!res.ok || !orderId) {
        const msg =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Не удалось оформить заказ";
        setError(msg);
        setSubmitting(false);
        return;
      }

      const bot = resolveBotUsername();
      const startParam = `order_${orderId}`;
      onBeforeNavigate?.();
      window.location.href = `https://t.me/${encodeURIComponent(bot)}?start=${encodeURIComponent(startParam)}`;
    } catch {
      setError("Сеть недоступна. Попробуйте ещё раз.");
      setSubmitting(false);
    }
  }, [cartItems, deliveryCountry, hydrated, onBeforeNavigate, submitting]);

  const disabled =
    !hydrated || cartItems.length === 0 || !deliveryCountry || submitting;

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => {
          void onClick();
        }}
        disabled={disabled}
        className={
          "inline-flex w-full flex-wrap items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-violet-700 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_10px_44px_rgba(124,58,237,0.5)] ring-1 ring-violet-400/40 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/90 disabled:pointer-events-none disabled:opacity-40 sm:gap-3 sm:px-6 sm:py-4 sm:text-base " +
          className
        }
      >
        <svg
          className="h-6 w-6 shrink-0 sm:h-7 sm:w-7"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.14 3.35-1.34 3.73-1.34.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
        </svg>
        <span className="min-w-0 text-balance text-center leading-snug">
          {submitting ? "Отправка заказа…" : "Оформить заказ в Telegram"}
        </span>
      </button>
      {error ? (
        <p className="mt-2 text-center text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
