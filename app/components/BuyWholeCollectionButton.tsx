"use client";

import { useMemo } from "react";
import type { StoredCard } from "@/app/api/cards/route";
import { useCart } from "@/app/context/CartContext";
import { playClick } from "@/app/lib/cartUx/playClick";
import {
  collectionOfferPrice,
  collectionPackCards,
  collectionRetailTotal,
} from "@/app/lib/collectionBundle";
import { isCustomOrderCategory } from "@/app/lib/customOrderHeroCarousel";

function money(n: number, suffix: string): string {
  const safe = Number.isFinite(n) ? n : 0;
  return `${safe.toLocaleString("ru-RU")} ${suffix}`;
}

type Props = {
  collectionName: string;
  cards: readonly StoredCard[];
};

export function BuyWholeCollectionButton({ collectionName, cards }: Props) {
  const { addCollectionToCart, openCart } = useCart();
  const packCards = useMemo(() => collectionPackCards(cards), [cards]);
  const retail = useMemo(() => collectionRetailTotal(packCards), [packCards]);
  const offer = useMemo(
    () => collectionOfferPrice(collectionName, retail),
    [collectionName, retail],
  );

  if (!collectionName.trim() || isCustomOrderCategory(collectionName)) {
    return null;
  }
  if (packCards.length === 0 || offer.byn <= 0) return null;

  const onClick = () => {
    playClick();
    addCollectionToCart({
      collectionName,
      cards: packCards,
      priceByn: offer.byn,
      priceRub: offer.rub,
    });
    openCart();
  };

  return (
    <div className="flex justify-center px-1">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex w-full max-w-xl flex-col items-center gap-1 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-violet-700 px-4 py-3.5 text-center shadow-[0_10px_44px_rgba(124,58,237,0.45)] ring-1 ring-violet-400/40 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/90 sm:px-6"
      >
        <span className="text-sm font-semibold text-white sm:text-base">
          Купить всю коллекцию
        </span>
        {offer.discounted ? (
          <>
            <span className="text-[11px] tabular-nums text-violet-200/80 line-through decoration-violet-200/50 sm:text-xs">
              {money(offer.retail.rub, "₽")} · {money(offer.retail.byn, "BYN")}
            </span>
            <span className="text-sm font-semibold tabular-nums text-white sm:text-base">
              со скидкой {money(offer.rub, "₽")} · {money(offer.byn, "BYN")}
            </span>
          </>
        ) : (
          <span className="text-sm font-semibold tabular-nums text-white sm:text-base">
            {money(offer.rub, "₽")} · {money(offer.byn, "BYN")}
          </span>
        )}
        <span className="text-[11px] text-violet-100/75">
          {packCards.length}{" "}
          {packCards.length === 1 ? "карточка" : "карточек"}
        </span>
      </button>
    </div>
  );
}
