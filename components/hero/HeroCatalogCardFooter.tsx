"use client";

import { Heart, ShoppingBag } from "lucide-react";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from "react";
import Link from "next/link";
import type { StoredCard } from "@/app/api/cards/route";
import { FavoritePopup } from "@/app/components/FavoritePopup";
import { useFavorites } from "@/app/context/FavoritesContext";
import { useAddToCartWithFeedback } from "@/app/lib/cartUx/useAddToCartWithFeedback";

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
  const { isFavorite, toggleFavorite } = useFavorites();
  const addToCartWithFeedback = useAddToCartWithFeedback();
  const [showPopup, setShowPopup] = useState(false);
  const liked = isFavorite(card.id);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const closePopup = useCallback(() => setShowPopup(false), []);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;

    const fit = () => {
      el.style.fontSize = "";
      el.style.whiteSpace = "nowrap";
      const maxPx = parseFloat(getComputedStyle(el).fontSize);
      if (!Number.isFinite(maxPx) || maxPx <= 0) return;
      const minPx = Math.max(12, maxPx * 0.58);
      if (el.scrollWidth <= el.clientWidth + 1) return;
      let lo = minPx;
      let hi = maxPx;
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        el.style.fontSize = `${mid}px`;
        if (el.scrollWidth <= el.clientWidth + 1) lo = mid;
        else hi = mid;
      }
      el.style.fontSize = `${lo}px`;
      if (el.scrollWidth > el.clientWidth + 1) {
        el.style.whiteSpace = "normal";
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [card.title]);

  function handleFavorite(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    const wasLiked = isFavorite(card.id);
    toggleFavorite(card);
    if (!wasLiked) setShowPopup(true);
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
        <Link
          href={`/card/${card.id}`}
          className="min-w-0 flex-1 text-center transition hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
        >
          <h3
            ref={titleRef}
            className={`hero-limited-card-title font-semibold text-white ${
              size === "novelty" ? "hero-limited-card-title--novelty" : ""
            }`}
          >
            {card.title}
          </h3>
        </Link>

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
