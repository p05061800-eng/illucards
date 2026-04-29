"use client";

import { MessageCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { useCart } from "@/app/context/CartContext";
import { getTelegramOrderBotUsername } from "@/app/lib/telegramOrderBotUsername";
import { startTelegramWebLoginWithWait } from "@/app/lib/startTelegramWebLoginClient";
import { telegramWebLoginDeepLink } from "@/app/lib/telegramWebLoginUrl";

type Props = {
  className?: string;
  onBeforeNavigate?: () => void;
};

export function TelegramCheckoutButton({
  className = "",
  onBeforeNavigate,
}: Props) {
  const router = useRouter();

  const openTelegramLogin = useCallback(async () => {
    router.push("/account");
    router.refresh();
    const ok = await startTelegramWebLoginWithWait();
    if (!ok && typeof window !== "undefined") {
      window.open(telegramWebLoginDeepLink(), "_blank", "noopener,noreferrer");
    }
  }, [router]);

  const { cartItems, hydrated, deliveryCountry, orderTotalByn } = useCart();
  const { primaryTelegramUserId, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = useCallback(async () => {
    if (!hydrated || cartItems.length === 0 || !deliveryCountry || submitting) {
      return;
    }
    if (primaryTelegramUserId == null) {
      setError("Сначала войдите в личный кабинет");
      router.push("/account");
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

      const orderPayload: Record<string, unknown> = {
        items,
        total: orderTotalByn,
        delivery: deliveryCountry,
        user_id: primaryTelegramUserId,
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
        if (res.status === 401) {
          setError("Сначала войдите в личный кабинет");
          router.push("/account");
        } else {
          setError(msg);
        }
        setSubmitting(false);
        return;
      }

      const bot = getTelegramOrderBotUsername();
      const startParam = `order_${orderId}`;
      onBeforeNavigate?.();
      window.location.assign(
        `https://t.me/${encodeURIComponent(bot)}?start=${encodeURIComponent(startParam)}`,
      );
    } catch {
      setError("Сеть недоступна. Попробуйте ещё раз.");
      setSubmitting(false);
    }
  }, [
    cartItems,
    deliveryCountry,
    hydrated,
    onBeforeNavigate,
    orderTotalByn,
    primaryTelegramUserId,
    router,
    submitting,
    user,
  ]);

  if (!hydrated) {
    return (
      <div className="w-full">
        <p className="text-center text-sm text-zinc-500">Загрузка…</p>
      </div>
    );
  }

  if (primaryTelegramUserId == null) {
    return (
      <div className="w-full">
        <button
          type="button"
          onClick={() => void openTelegramLogin()}
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#229ED9] px-3 py-3 text-center text-xs font-semibold leading-snug text-white shadow-md transition hover:brightness-105 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/80 active:scale-[0.99] sm:min-h-[3.5rem] sm:px-4 sm:text-sm md:text-base"
        >
          <MessageCircle className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" strokeWidth={2} aria-hidden />
          Авторизоваться через телеграм для заказа
        </button>
      </div>
    );
  }

  const disabled =
    cartItems.length === 0 || !deliveryCountry || submitting;

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
        <span className="min-w-0 text-balance text-center text-xs leading-snug sm:text-sm md:text-base">
          {submitting
            ? "Сохраняем заказ…"
            : "Оформить заказ через телеграм бот"}
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
