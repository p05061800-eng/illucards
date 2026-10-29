"use client";

import { useState } from "react";
import type { StoredCard } from "@/app/api/cards/route";
import { useAddToCartWithFeedback } from "@/app/lib/cartUx/useAddToCartWithFeedback";
import {
  CUSTOM_ORDER_PRICE_BYN,
  CUSTOM_ORDER_PRICE_RUB,
} from "@/app/lib/customOrderPricing";

function QtyChip({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
      <span className="text-sm text-zinc-300">{label}</span>
      <div className="inline-flex items-center rounded-md border border-white/12 bg-zinc-950 text-sm">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="px-2.5 py-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          aria-label={`${label}: меньше`}
        >
          −
        </button>
        <span className="min-w-[1.75rem] px-1 text-center tabular-nums text-zinc-100">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(99, value + 1))}
          className="px-2.5 py-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          aria-label={`${label}: больше`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function CustomOrderBuyPanel({
  card,
  inStock,
}: {
  card: StoredCard;
  inStock: boolean;
}) {
  const [originals, setOriginals] = useState(1);
  const addToCartWithFeedback = useAddToCartWithFeedback();

  const addCurrent = () => {
    const source = document.querySelector("[data-cart-fly-source]");
    addToCartWithFeedback(card, source as HTMLElement | null, {
      originals,
      copies: 0,
    });
  };

  return (
    <div className="mb-6 flex w-full max-w-xl flex-col gap-3 sm:max-w-none">
      <p className="text-sm leading-relaxed text-zinc-300">
        Дальнейшее оформление заказа — в Telegram-боте.
      </p>
      <p className="text-sm leading-relaxed text-zinc-400">
        Стоимость одной карточки на заказ — {CUSTOM_ORDER_PRICE_RUB} ₽ или{" "}
        {CUSTOM_ORDER_PRICE_BYN} BYN. Каждая дополнительная копия того же макета
        — со скидкой 50%.
      </p>
      <QtyChip
        label="Количество"
        value={originals}
        min={1}
        onChange={setOriginals}
      />
      <p className="text-sm leading-relaxed text-zinc-400">
        Копию можете добавить в корзине.
      </p>
      <button
        type="button"
        disabled={!inStock}
        onClick={addCurrent}
        className="w-full rounded-xl border border-purple-500/45 bg-purple-950/40 px-4 py-2.5 text-sm font-semibold text-purple-100 transition hover:border-purple-400/55 hover:bg-purple-900/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        В корзину
      </button>
    </div>
  );
}
