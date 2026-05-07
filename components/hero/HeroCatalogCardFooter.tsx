"use client";

import { Heart, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, type MouseEvent, type RefObject } from "react";
import type { StoredCard } from "@/app/api/cards/route";
import { FavoritePopup } from "@/app/components/FavoritePopup";
import { useFavorites } from "@/app/context/FavoritesContext";
import { useAddToCartWithFeedback } from "@/app/lib/cartUx/useAddToCartWithFeedback";
import {
  catalogCardAnchorId,
  rememberCatalogReturnCardId,
} from "@/app/lib/catalogScrollRestore";

type Props = {
  card: StoredCard;
  flySourceRef: RefObject<HTMLElement | null>;
  size?: "default" | "novelty";
};

/** Нижняя часть плитки как в каталоге (`CardItem`): название, звёзды, цена, избранное, корзина. */
export function HeroCatalogCardFooter({
  card,
  flySourceRef,
  size = "default",
}: Props) {
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();
  const addToCartWithFeedback = useAddToCartWithFeedback();
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
    rememberCatalogReturnCardId(card.id);
    router.push(`/#${catalogCardAnchorId(card.id)}`);
  }

  return (
    <div
      className={`hero-limited-card-footer w-full min-w-0 ${
        size === "novelty"
          ? "hero-limited-card-footer--novelty"
          : "hero-limited-card-footer--default"
      }`}
    >
      <FavoritePopup show={showPopup} onClose={closePopup} />
      <div className="hero-limited-card-titlebar">
        <button
          type="button"
          onClick={goToCardPage}
          className="min-w-0 flex-1 text-left transition hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
        >
          <h3
            className={`hero-limited-card-title line-clamp-2 font-semibold text-white ${
              size === "novelty" ? "hero-limited-card-title--novelty" : ""
            }`}
          >
            {card.title}
          </h3>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleFavorite}
            className={`hero-limited-card-action ${
              liked
                ? "hero-limited-card-action--favorite-active"
                : "hero-limited-card-action--favorite"
            }`}
            aria-label={liked ? "Убрать из избранного" : "В избранное"}
            aria-pressed={liked}
          >
            <Heart
              className="h-[1.05rem] w-[1.05rem]"
              fill={liked ? "currentColor" : "none"}
              aria-hidden
            />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              addToCartWithFeedback(card, flySourceRef.current);
            }}
            className={`hero-limited-card-action hero-limited-card-action--cart ${
              size === "novelty" ? "hero-limited-card-action--cart-catalog" : ""
            }`}
            aria-label="В корзину"
          >
            <ShoppingBag
              className={size === "novelty" ? "h-5 w-5" : "h-[1.05rem] w-[1.05rem]"}
              aria-hidden
            />
          </button>
        </div>
      </div>
    </div>
  );
}
