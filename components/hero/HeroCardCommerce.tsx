"use client";

import { Heart, ShoppingBag } from "lucide-react";
import { useCallback, useMemo, useState, type MouseEvent, type RefObject } from "react";
import type { CardRarity, StoredCard } from "@/app/api/cards/route";
import { FavoritePopup } from "@/app/components/FavoritePopup";
import { useCurrency } from "@/app/context/CurrencyContext";
import { useFavorites } from "@/app/context/FavoritesContext";
import { useAddToCartWithFeedback } from "@/app/lib/cartUx/useAddToCartWithFeedback";
import { formatCardPrice } from "@/app/lib/formatPrice";

const RARITY_LABELS: Record<CardRarity, string> = {
  common: "Обычная",
  limited: "Лимитированная",
  adult: "18+",
  novelty: "Новинки",
  hot_price: "Горячая цена",
};

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
  const { currency } = useCurrency();
  const { isFavorite, toggleFavorite } = useFavorites();
  const addToCartWithFeedback = useAddToCartWithFeedback();
  const [showPopup, setShowPopup] = useState(false);
  const liked = isFavorite(card.id);
  const rarity = card.rarity ?? "limited";
  const showNewPill = card.isNew && rarity !== "novelty";

  const metaLine = useMemo(() => {
    const parts: string[] = [RARITY_LABELS[rarity]];
    if (showNewPill) parts.push("Новинка");
    if (card.isSale) parts.push("Акция");
    parts.push(card.inStock ? "В наличии" : "Нет в наличии");
    return parts.join(" · ");
  }, [rarity, showNewPill, card.isSale, card.inStock]);

  const closePopup = useCallback(() => setShowPopup(false), []);

  function handleFavorite(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    const wasLiked = isFavorite(card.id);
    toggleFavorite(card);
    if (!wasLiked) setShowPopup(true);
  }

  const btnRow =
    "inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-transparent px-3 py-2 text-center text-[13px] font-medium leading-tight text-zinc-100 transition hover:border-white/30 hover:bg-white/[0.06] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35 sm:px-4 sm:text-sm";

  return (
    <aside
      className={
        variant === "noveltiesBlock"
          ? "flex w-full min-w-0 max-w-full flex-col gap-4"
          : "flex w-full min-w-0 max-w-full flex-col gap-4 lg:max-w-[min(100%,min(92vw,520px))] lg:shrink-0"
      }
    >
      <FavoritePopup show={showPopup} onClose={closePopup} />

      <div>
        <p className="text-xs text-zinc-500">{card.category}</p>
        <h3 className="mt-0.5 line-clamp-2 text-xl font-medium leading-snug tracking-tight text-white sm:text-2xl">
          {card.title}
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">{metaLine}</p>
      </div>

      <p
        className="text-2xl font-light tabular-nums tracking-tight text-white sm:text-3xl"
        aria-live="polite"
      >
        {formatCardPrice(card.price, currency)}
      </p>

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
