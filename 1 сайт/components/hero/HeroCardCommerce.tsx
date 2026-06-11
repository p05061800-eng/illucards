"use client";

import { Heart, ShoppingBag } from "lucide-react";
import { useCallback, useMemo, useState, type MouseEvent, type RefObject } from "react";
import type { StoredCard } from "@/app/api/cards/route";
import {
  cardHasRarityTag,
  formatRarityLabelsRu,
} from "@/app/lib/cardRarityTags";
import { FavoritePopup } from "@/app/components/FavoritePopup";
import { useFavorites } from "@/app/context/FavoritesContext";
import { useAddToCartWithFeedback } from "@/app/lib/cartUx/useAddToCartWithFeedback";
import { CardPriceDualRow } from "@/app/components/CardPriceDualRow";

type Props = {
  card: StoredCard;
  flySourceRef: RefObject<HTMLElement | null>;
  onOpenCard: () => void;
  /** В блоке «Новинки» слева — на всю ширину колонки */
  variant?: "besideCard" | "noveltiesBlock";
};

export function HeroCardCommerce({
  card,
  flySourceRef,
  onOpenCard,
  variant = "besideCard",
}: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const addToCartWithFeedback = useAddToCartWithFeedback();
  const [showPopup, setShowPopup] = useState(false);
  const liked = isFavorite(card.id);
  const showNewPill = card.isNew && !cardHasRarityTag(card, "novelty");

  const metaLine = useMemo(() => {
    const parts: string[] = [formatRarityLabelsRu(card)];
    if (showNewPill) parts.push("Новинка");
    if (card.isSale) parts.push("Акция");
    parts.push(card.inStock ? "В наличии" : "Уже раскупили");
    return parts.join(" · ");
  }, [card, showNewPill]);

  const closePopup = useCallback(() => setShowPopup(false), []);

  function handleFavorite(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    const wasLiked = isFavorite(card.id);
    toggleFavorite(card);
    if (!wasLiked) setShowPopup(true);
  }

  const btnRow =
    "hero-commerce-btn inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-transparent py-2 text-center font-medium leading-tight text-zinc-100 transition hover:border-white/30 hover:bg-white/[0.06] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35";

  return (
    <aside
      className={
        variant === "noveltiesBlock"
          ? "flex w-full min-w-0 max-w-full flex-col gap-3 sm:gap-4"
          : "flex w-full min-w-0 max-w-full flex-col gap-[clamp(0.75rem,1.8vw,1.25rem)] lg:max-w-[min(100%,min(92vw,520px))] lg:shrink-0"
      }
    >
      <FavoritePopup show={showPopup} onClose={closePopup} />

      <div>
        {variant !== "noveltiesBlock" ? (
          <p className="text-xs text-zinc-500">{card.category}</p>
        ) : null}
        <h3
          className={
            variant === "noveltiesBlock"
              ? "hero-commerce-title line-clamp-2 font-medium leading-snug tracking-tight text-white"
              : "hero-commerce-title mt-0.5 line-clamp-2 font-medium leading-snug tracking-tight text-white"
          }
        >
          {card.title}
        </h3>
        {variant === "noveltiesBlock" ? (
          <>
            {!card.inStock ? (
              <p className="mt-2 text-xs text-amber-400/90">Уже раскупили</p>
            ) : null}
            {card.isSale && card.inStock ? (
              <p className="mt-1.5 text-xs text-emerald-400/85">Акция</p>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">{metaLine}</p>
        )}
      </div>

      <div aria-live="polite">
        <CardPriceDualRow card={card} variant="hero" />
      </div>

      {/* Все действия в одну строку; на узком экране перенос */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            addToCartWithFeedback(card, flySourceRef.current);
          }}
          disabled={!card.inStock}
          className={`${btnRow} border-emerald-400/35 text-emerald-50 hover:border-emerald-400/55 hover:bg-emerald-500/10 disabled:hover:border-emerald-400/35`}
        >
          <ShoppingBag className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
          В корзину
        </button>
        <button
          type="button"
          onClick={handleFavorite}
          className={`${btnRow} ${liked ? "border-rose-400/30 text-rose-200/95 hover:bg-rose-500/10" : ""}`}
          aria-label={liked ? "Убрать из избранного" : "В избранное"}
          aria-pressed={liked}
        >
          <Heart
            className={`h-4 w-4 shrink-0 ${liked ? "fill-rose-400/80 text-rose-400" : ""}`}
            strokeWidth={1.75}
            aria-hidden
          />
          Избранное
        </button>
        <button type="button" onClick={onOpenCard} className={btnRow}>
          Подробнее
        </button>
      </div>
    </aside>
  );
}
