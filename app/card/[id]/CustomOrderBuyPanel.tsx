"use client";

import type { StoredCard } from "@/app/api/cards/route";
import {
  CUSTOM_ORDER_PRICE_BYN,
  CUSTOM_ORDER_PRICE_RUB,
} from "@/app/lib/customOrderPricing";

export function CustomOrderBuyPanel({
  card: _card,
}: {
  card: StoredCard;
  inStock: boolean;
}) {
  return (
    <div className="mb-6 flex w-full max-w-xl flex-col gap-3 sm:max-w-none">
      <p className="text-sm leading-relaxed text-zinc-300">
        Карточка на заказ сейчас в разработке.
      </p>
      <p className="text-sm leading-relaxed text-zinc-400">
        Стоимость одной карточки на заказ — {CUSTOM_ORDER_PRICE_RUB} ₽ или{" "}
        {CUSTOM_ORDER_PRICE_BYN} BYN. Каждая дополнительная копия того же макета
        — со скидкой 50%.
      </p>
      <p className="text-sm leading-relaxed text-zinc-400">
        Срок изготовления — 2–3 дня.
      </p>
      <button
        type="button"
        disabled
        className="w-full rounded-xl border border-white/15 bg-zinc-900/80 px-4 py-2.5 text-sm font-semibold text-zinc-400 disabled:cursor-not-allowed"
      >
        (в разработке)
      </button>
    </div>
  );
}
