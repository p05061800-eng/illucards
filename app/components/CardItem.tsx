"use client";

import { ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type MouseEvent } from "react";
import type { StoredCard } from "../api/cards/route";
import { useCurrency } from "../context/CurrencyContext";
import { useFavorites } from "../context/FavoritesContext";
import { useAddToCartWithFeedback } from "../lib/cartUx/useAddToCartWithFeedback";
import { formatCardPrice } from "../lib/formatPrice";
import { ultraOrHeroBgUrl } from "../lib/cardUltraBg";
import { CardStackVisual } from "@/components/hero/CardStackVisual";
import { FavoritePopup } from "./FavoritePopup";

type Props = {
  card: StoredCard;
  /** Скрыть третий наискосок слой (ultra) — сетка коллекции на главной */
  hideUltraLayer?: boolean;
};

export function CardItem({ card, hideUltraLayer = false }: Props) {
  const router = useRouter();
  const { currency } = useCurrency();
  const { isFavorite, toggleFavorite } = useFavorites();
  const addToCartWithFeedback = useAddToCartWithFeedback();
  const flyRef = useRef<HTMLDivElement>(null);
  const [showPopup, setShowPopup] = useState(false);
  const liked = isFavorite(card.id);

  const closePopup = useCallback(() => setShowPopup(false), []);

  function handleFavorite(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    const wasLiked = isFavorite(card.id);
    toggleFavorite(card);
    if (!wasLiked) setShowPopup(true);
  }

  function goToCardPage() {
    router.push(`/card/${card.id}`);
  }

  return (
    <div className="flex min-w-0 w-full flex-col overflow-visible text-left">
      <div
        ref={flyRef}
        className="relative w-full min-w-0 cursor-pointer"
        onClick={goToCardPage}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            goToCardPage();
          }
        }}
        role="link"
        tabIndex={0}
        aria-label={`Открыть карточку: ${card.title}`}
      >
        <CardStackVisual
          card={card}
          ultraBgUrl={ultraOrHeroBgUrl(card)}
          catalogStack
          hideUltraLayer={hideUltraLayer}
          rootClassName="relative mx-auto aspect-[3/4] w-full max-w-[min(100%,360px)] rounded-2xl"
          dataCartFlySource
        />
      </div>

      <FavoritePopup show={showPopup} onClose={closePopup} />

      <div className="flex flex-col gap-2 p-3">
        <button
          type="button"
          onClick={goToCardPage}
          className="w-full text-left transition hover:text-purple-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50"
        >
          <h3 className="line-clamp-2 text-sm font-semibold text-white sm:text-base">
            {card.title}
          </h3>
        </button>

        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold tabular-nums text-white sm:text-base">
            {formatCardPrice(card.price, currency)}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleFavorite(e);
              }}
              className={`rounded-full p-2 text-lg transition hover:brightness-125 active:opacity-80 ${
                liked ? "text-red-400" : "text-white/85"
              }`}
              aria-label={liked ? "Убрать из избранного" : "В избранное"}
              aria-pressed={liked}
            >
              {liked ? "❤️" : "🤍"}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                addToCartWithFeedback(card, flyRef.current);
              }}
              className="shrink-0 rounded-full bg-green-500 p-2 text-white transition-all duration-300 ease-out hover:shadow-lg hover:shadow-green-500/35 hover:brightness-110 active:opacity-90"
              aria-label="В корзину"
            >
              <ShoppingBag className="h-5 w-5 text-white" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
