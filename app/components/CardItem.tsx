"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type MouseEvent } from "react";
import type { StoredCard } from "../api/cards/route";
import { useAdultContentGateOptional } from "../context/AdultContentContext";
import { useMergedRating } from "../context/CardRatingsContext";
import { useFavorites } from "../context/FavoritesContext";
import {
  cardRequiresAgeConfirmation,
  catalogCardFrameClass,
} from "../lib/cardRequiresAgeConfirmation";
import { useAddToCartWithFeedback } from "../lib/cartUx/useAddToCartWithFeedback";
import { ultraOrHeroBgUrl } from "../lib/cardUltraBg";
import { CardStackVisual } from "@/components/hero/CardStackVisual";
import { AgeConfirmDialog } from "./AdultContentBlurGate";
import { CardPriceDualRow } from "./CardPriceDualRow";
import { CardRatingStars } from "./CardRatingStars";
import { FavoritePopup } from "./FavoritePopup";

type Props = {
  card: StoredCard;
  /** Скрыть третий наискосок слой (ultra) — сетка коллекции на главной */
  hideUltraLayer?: boolean;
};

/** Как в HeroCardStack: короткий тап — переход; микросдвиг — vario/3D без потери click в WebKit */
const TAP_MAX_PX = 22;

const ADULT_BADGE_CLASS =
  "pointer-events-none absolute right-1 top-1 z-[130] rounded border border-rose-400/85 bg-rose-950/92 px-1.5 py-0.5 text-[10px] font-extrabold uppercase leading-none tracking-wide text-rose-50 shadow-[0_0_12px_rgba(244,63,94,0.35)]";

export function CardItem({ card, hideUltraLayer = false }: Props) {
  const router = useRouter();
  const adultGate = useAdultContentGateOptional();
  const needs18 = cardRequiresAgeConfirmation(card);
  const confirmed18 = needs18
    ? (adultGate?.isAdultConfirmed(card.id) ?? false)
    : true;
  const adultBlockedNav = needs18 && !confirmed18;
  const [ageOpen, setAgeOpen] = useState(false);
  const pendingNavRef = useRef<string | null>(null);
  const merged = useMergedRating(card);
  const { isFavorite, toggleFavorite } = useFavorites();
  const addToCartWithFeedback = useAddToCartWithFeedback();
  const flyRef = useRef<HTMLAnchorElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const liked = isFavorite(card.id);

  const closePopup = useCallback(() => setShowPopup(false), []);

  function handleFavorite(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    const wasLiked = isFavorite(card.id);
    toggleFavorite(card);
    if (!wasLiked) setShowPopup(true);
  }

  const cardHref = `/card/${card.id}`;

  function openCardNav(href: string) {
    if (adultBlockedNav) {
      pendingNavRef.current = href;
      setAgeOpen(true);
    } else {
      router.push(href);
    }
  }

  function goToCardPage() {
    openCardNav(cardHref);
  }

  return (
    <div className="card flex h-full min-h-0 min-w-0 w-full flex-col overflow-visible text-left">
      <AgeConfirmDialog
        open={ageOpen}
        onClose={() => {
          setAgeOpen(false);
          pendingNavRef.current = null;
        }}
        onConfirm={() => {
          adultGate?.confirmAdultForCard(card.id);
          setAgeOpen(false);
          const h = pendingNavRef.current;
          pendingNavRef.current = null;
          if (h) router.push(h);
        }}
      />

      <Link
        ref={flyRef}
        href={cardHref}
        prefetch
        className="catalog-card-image-link relative block w-full min-w-0 shrink-0 cursor-pointer overflow-visible"
        aria-label={`Открыть карточку: ${card.title}`}
        onClick={(e) => {
          if (adultBlockedNav) {
            e.preventDefault();
            pendingNavRef.current = cardHref;
            setAgeOpen(true);
          }
        }}
        onTouchStartCapture={(e) => {
          if (e.touches.length === 0) return;
          const t = e.touches[0];
          touchStartRef.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const start = touchStartRef.current;
          touchStartRef.current = null;
          if (!start || e.changedTouches.length === 0) return;
          const t = e.changedTouches[0];
          const dx = Math.abs(t.clientX - start.x);
          const dy = Math.abs(t.clientY - start.y);
          if (dx <= TAP_MAX_PX && dy <= TAP_MAX_PX) {
            e.preventDefault();
            openCardNav(cardHref);
          }
        }}
        onTouchCancel={() => {
          touchStartRef.current = null;
        }}
      >
        <div
          className={`relative overflow-visible rounded-t-2xl ${catalogCardFrameClass(card)}`}
        >
          {needs18 ? (
            <span className={ADULT_BADGE_CLASS} aria-hidden>
              18+
            </span>
          ) : null}
          <CardStackVisual
            card={card}
            ultraBgUrl={ultraOrHeroBgUrl(card)}
            catalogStack
            hideUltraLayer={hideUltraLayer}
            rootClassName="relative mx-auto max-w-full rounded-t-2xl"
            dataCartFlySource
          />
        </div>
      </Link>

      <FavoritePopup show={showPopup} onClose={closePopup} />

      <div className="card-content catalog-card-content flex min-h-0 min-w-0 flex-1 flex-col gap-2 rounded-b-2xl border-t border-white/[0.06] bg-zinc-950/70 p-3 pt-2.5">
        <div className="min-h-0 w-full shrink-0">
          <button
            type="button"
            onClick={goToCardPage}
            className="w-full text-left transition hover:text-purple-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50"
          >
            <h3 className="card-title text-sm font-semibold leading-snug text-white sm:text-base">
              {card.title}
            </h3>
          </button>
        </div>

        <div className="card-bottom catalog-card-bottom flex w-full min-w-0 shrink-0 flex-col gap-2 border-t border-white/[0.06] pt-2.5">
          <div className="catalog-card-rating-row flex min-h-[1.375rem] items-center gap-1.5 px-0.5">
            <CardRatingStars value={merged.avg} compact />
            <span className="text-[11px] font-semibold tabular-nums text-amber-200/90">
              {merged.avg.toFixed(1)}
            </span>
          </div>

          <div className="catalog-card-price-row flex min-h-[2.25rem] min-w-0 flex-nowrap items-center justify-between gap-1 sm:gap-2">
            <div className="min-w-0 flex-1 overflow-hidden pr-0.5 sm:pr-0">
              <CardPriceDualRow
                card={card}
                variant="catalog"
                className="text-[11px] font-semibold leading-tight sm:text-sm sm:leading-normal md:text-base"
              />
            </div>
            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFavorite(e);
                }}
                className={`shrink-0 rounded-full p-1 text-sm transition hover:brightness-125 active:opacity-80 sm:p-2 sm:text-lg ${
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
                className="shrink-0 rounded-full bg-green-500 p-1 text-white transition-all duration-300 ease-out hover:shadow-lg hover:shadow-green-500/35 hover:brightness-110 active:opacity-90 sm:p-2"
                aria-label="В корзину"
              >
                <ShoppingBag
                  className="h-4 w-4 text-white sm:h-5 sm:w-5"
                  aria-hidden
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
