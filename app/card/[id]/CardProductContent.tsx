"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgePercent, Heart, ShieldCheck, SlidersHorizontal, Truck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StoredCard } from "../../api/cards/route";
import type { UserReviewEntry } from "@/app/lib/userReviews";
import { CardDescriptionText } from "../../components/CardDescriptionText";
import { CardRatingStars } from "../../components/CardRatingStars";
import { FavoritePopup } from "../../components/FavoritePopup";
import { InteractiveRating } from "../../components/InteractiveRating";
import { useMergedRating } from "../../context/CardRatingsContext";
import { useFavorites } from "../../context/FavoritesContext";
import { useAddToCartWithFeedback } from "../../lib/cartUx/useAddToCartWithFeedback";
import {
  EMPTY_TYPE_FILTER,
  filterCollectionCards,
  sortCardsByPrice,
  sortCardsForGalleryBrowse,
  sortSectionCardsForDefaultCatalog,
} from "@/app/lib/collectionFilter";
import { collectionSectionId } from "../../lib/collectionAnchor";
import {
  cardArtFaceFitStyle,
  cardArtFaceObjectFitClass,
} from "../../lib/imageFocus";
import { useCatalogFilter } from "@/app/context/CatalogFilterContext";
import { CardPriceDualRow } from "../../components/CardPriceDualRow";
import {
  AdultContentBlurGate,
  AgeConfirmDialog,
} from "../../components/AdultContentBlurGate";
import {
  cardRequiresAgeConfirmation,
  catalogCardFrameClass,
} from "../../lib/cardRequiresAgeConfirmation";
import { useAdultContentGateOptional } from "../../context/AdultContentContext";
import { ProductReviewsSection } from "../../components/ProductReviewsSection";
import { CardProductGallery } from "./CardProductGallery";
import type { CardRarity } from "../../lib/cardRarityTags";
import {
  formatRarityLabelsRu,
  primaryRarityForUi,
} from "../../lib/cardRarityTags";

const RARITY_BADGE: Record<CardRarity, string> = {
  common:
    "border-zinc-500/50 bg-zinc-900/90 text-zinc-200 shadow-[0_0_12px_rgba(161,161,170,0.25)]",
  limited:
    "border-amber-400/50 bg-amber-950/80 text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.35)]",
  adult:
    "border-rose-400/50 bg-rose-950/80 text-rose-100 shadow-[0_0_16px_rgba(244,63,94,0.35)]",
  replica:
    "border-sky-400/50 bg-sky-950/80 text-sky-100 shadow-[0_0_16px_rgba(56,189,248,0.35)]",
  novelty:
    "border-emerald-400/50 bg-emerald-950/80 text-emerald-100 shadow-[0_0_16px_rgba(52,211,153,0.35)]",
  hot_price:
    "border-fuchsia-400/60 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_20px_rgba(217,70,239,0.45)]",
};

function ratingCountWord(n: number): string {
  const m = n % 100;
  if (m >= 11 && m <= 14) return "оценок";
  const mod = n % 10;
  if (mod === 1) return "оценка";
  if (mod >= 2 && mod <= 4) return "оценки";
  return "оценок";
}

const MINI_RAIL_TAP_MAX_PX = 22;

const MINI_RAIL_ADULT_BADGE =
  "pointer-events-none absolute right-0.5 top-0.5 z-[130] rounded border border-rose-400/85 bg-rose-950/92 px-1 py-0.5 text-[9px] font-extrabold uppercase leading-none text-rose-50 shadow-[0_0_12px_rgba(244,63,94,0.35)]";

function MiniRailCard({ card: c }: { card: StoredCard }) {
  const router = useRouter();
  const adultGate = useAdultContentGateOptional();
  const merged = useMergedRating(c);
  const img = c.frontImage?.trim();
  const needs18 = cardRequiresAgeConfirmation(c);
  const blocked = needs18 && !(adultGate?.isAdultConfirmed(c.id) ?? false);
  const [ageOpen, setAgeOpen] = useState(false);
  const pendingHrefRef = useRef<string | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const href = `/card/${c.id}`;

  function openNav() {
    if (blocked) {
      pendingHrefRef.current = href;
      setAgeOpen(true);
    } else {
      router.push(href);
    }
  }

  return (
    <>
      <AgeConfirmDialog
        open={ageOpen}
        onClose={() => {
          setAgeOpen(false);
          pendingHrefRef.current = null;
        }}
        onConfirm={() => {
          adultGate?.confirmAdultForCard(c.id);
          setAgeOpen(false);
          const h = pendingHrefRef.current;
          pendingHrefRef.current = null;
          if (h) router.push(h);
        }}
      />
      <Link
        href={href}
        className="group flex w-[min(148px,40vw)] shrink-0 flex-col overflow-visible rounded-lg border border-white/10 bg-zinc-950/60 transition hover:border-purple-500/40 hover:bg-zinc-900/80 sm:w-[148px]"
        onClick={(e) => {
          if (blocked) {
            e.preventDefault();
            pendingHrefRef.current = href;
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
          if (dx <= MINI_RAIL_TAP_MAX_PX && dy <= MINI_RAIL_TAP_MAX_PX) {
            e.preventDefault();
            openNav();
          }
        }}
        onTouchCancel={() => {
          touchStartRef.current = null;
        }}
      >
        <div
          className={`relative w-full overflow-visible rounded-t-lg bg-zinc-900 ${catalogCardFrameClass(c)}`}
        >
          {needs18 ? (
            <span className={MINI_RAIL_ADULT_BADGE} aria-hidden>
              18+
            </span>
          ) : null}
          {img ? (
            <AdultContentBlurGate
              isAdult={needs18}
              cardId={c.id}
              mode="blurOnly"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img}
                alt=""
                className={`block h-auto w-full max-w-full ${cardArtFaceObjectFitClass(c.cardArtFramePreset)}`}
                style={cardArtFaceFitStyle(
                  c.cardArtFramePreset,
                  c.frontImageFocus,
                )}
              />
            </AdultContentBlurGate>
          ) : null}
        </div>
        <div className="flex min-h-[3.5rem] flex-col gap-1.5 p-2">
          <p className="line-clamp-2 text-xs font-medium leading-tight text-zinc-100">
            {c.title}
          </p>
          <div className="flex items-center gap-1.5">
            <CardRatingStars value={merged.avg} compact />
            <span className="text-[10px] font-semibold tabular-nums text-amber-200/95">
              {merged.avg.toFixed(1)}
            </span>
          </div>
          <CardPriceDualRow card={c} variant="rail" />
        </div>
      </Link>
    </>
  );
}

function CardMiniRail({
  title,
  cards,
}: {
  title: string;
  cards: StoredCard[];
}) {
  if (cards.length === 0) return null;
  return (
    <section className="border-t border-white/10 pt-7">
      <h2 className="mb-3 text-base font-bold text-white">{title}</h2>
      <div className="scrollbar-hide flex gap-2.5 overflow-x-auto pb-2 sm:gap-3">
        {cards.map((c) => (
          <MiniRailCard key={c.id} card={c} />
        ))}
      </div>
    </section>
  );
}

type Props = {
  card: StoredCard;
  categoryCards: StoredCard[];
  /** Весь каталог — для листания галереи и сортировки «ещё из категории». */
  allCards?: StoredCard[];
};

export default function CardProductContent({
  card,
  categoryCards,
  allCards = [],
}: Props) {
  const [favoritePopup, setFavoritePopup] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();
  const {
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    typeFilter,
    setTypeFilter,
    toggleType,
    priceSort,
    setPriceSort,
    filtersOpen,
    setFiltersOpen,
  } = useCatalogFilter();
  const router = useRouter();
  const liked = isFavorite(card.id);
  const addToCartWithFeedback = useAddToCartWithFeedback();
  const rarityUi = primaryRarityForUi(card);
  const rarityLine = formatRarityLabelsRu(card);
  const backHref = "/#collection";
  const inStock = card.inStock !== false;
  const merged = useMergedRating(card);
  const adminReviews = card.reviews ?? [];
  const [userReviews, setUserReviews] = useState<UserReviewEntry[]>([]);

  const refreshUserReviews = useCallback(() => {
    void fetch(`/api/user-reviews?cardId=${encodeURIComponent(card.id)}`)
      .then((res) => res.json())
      .then((d: { reviews?: UserReviewEntry[] }) => {
        setUserReviews(d.reviews ?? []);
      })
      .catch(() => {});
  }, [card.id]);

  useEffect(() => {
    refreshUserReviews();
  }, [refreshUserReviews]);

  const moreFromCategory = categoryCards.filter((c) => c.id !== card.id);

  const allCategoryNames = useMemo(() => {
    return [
      ...new Set(
        allCards
          .map((c) => c.category?.trim() ?? "")
          .filter((n) => n.length > 0)
      ),
    ].sort((a, b) => a.localeCompare(b, "ru"));
  }, [allCards]);

  const openCategory = useCallback(
    (categoryName: string) => {
      const normalized = categoryName.trim();
      const categoryCards = allCards.filter(
        (c) => (c.category?.trim() ?? "") === normalized
      );
      const firstCard = categoryCards.length
        ? sortSectionCardsForDefaultCatalog(categoryCards, allCards)[0]
        : undefined;

      if (firstCard) {
        router.push(`/card/${firstCard.id}`);
        return;
      }

      setSearch("");
      setCategoryFilter(categoryName);
      setTypeFilter(EMPTY_TYPE_FILTER);
      setPriceSort("default");
      router.push("/#collection");
    },
    [allCards, router, setCategoryFilter, setPriceSort, setSearch, setTypeFilter]
  );

  const openFilterPanel = useCallback(() => {
    setFiltersOpen((open) => !open);
  }, [setFiltersOpen]);

  /**
   * Листание стрелками: тот же порядок, что в каталоге, плюс фильтры из шапки/панели
   * (категория, тип, цена, поиск). Если текущая карточка не попадает в фильтр — остаётся
   * первой в списке, дальше листаются только отфильтрованные.
   */
  const galleryBrowseCards = useMemo(() => {
    const base =
      allCards.length > 1
        ? sortCardsForGalleryBrowse([...allCards], allCards)
        : categoryCards.length > 1
          ? sortSectionCardsForDefaultCatalog([...categoryCards], allCards)
          : [card];

    const filtered = filterCollectionCards(base, {
      search,
      category: categoryFilter,
      typeFilter,
    });
    const sorted = sortCardsByPrice(filtered, priceSort);
    if (sorted.length === 0) return [card];
    if (sorted.some((c) => c.id === card.id)) return sorted;
    return [card, ...sorted];
  }, [
    allCards,
    categoryCards,
    card,
    search,
    categoryFilter,
    typeFilter,
    priceSort,
  ]);

  const onFavoriteClick = useCallback(() => {
    const was = isFavorite(card.id);
    toggleFavorite(card);
    if (!was) setFavoritePopup(true);
  }, [card, isFavorite, toggleFavorite]);

  return (
    <>
      <FavoritePopup show={favoritePopup} onClose={() => setFavoritePopup(false)} />

      <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-col gap-7 px-4 pb-20 pt-5 sm:gap-8 sm:px-5 sm:pt-8 lg:gap-10 lg:px-8 xl:max-w-[1240px] xl:px-10">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-purple-300 sm:text-sm"
          >
            <span aria-hidden className="text-base leading-none sm:text-lg">
              ←
            </span>
            Назад к коллекции
          </Link>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <div className="flex min-w-0 flex-wrap gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {allCategoryNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => openCategory(name)}
                  className={`inline-flex shrink-0 items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    name === card.category
                      ? "border-violet-400/70 bg-violet-500/15 text-violet-100"
                      : "border-white/10 bg-white/5 text-zinc-300 hover:border-violet-400/30 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={openFilterPanel}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-4 py-2 text-sm font-semibold text-white transition hover:border-violet-400/30 hover:bg-violet-950/60"
            >
              <SlidersHorizontal className="h-4 w-4 text-violet-300" aria-hidden />
              {filtersOpen ? "Свернуть фильтр" : "Фильтр"}
            </button>
          </div>
        </div>

        {filtersOpen ? (
          <div className="mb-4 rounded-2xl border border-white/10 bg-zinc-950/80 p-4 text-sm text-zinc-200 shadow-[0_0_30px_rgba(0,0,0,0.25)]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Категория
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryFilter("");
                    }}
                    className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      !categoryFilter
                        ? "border-violet-400/70 bg-violet-500/15 text-violet-100"
                        : "border-white/10 bg-white/5 text-zinc-300 hover:border-violet-400/30 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    Все категории
                  </button>
                  {allCategoryNames.map((name) => (
                    <button
                      key={`filter-${name}`}
                      type="button"
                      onClick={() => setCategoryFilter(name)}
                      className={`inline-flex shrink-0 items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        categoryFilter === name
                          ? "border-violet-400/70 bg-violet-500/15 text-violet-100"
                          : "border-white/10 bg-white/5 text-zinc-300 hover:border-violet-400/30 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Тип карточки
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { key: "adult", label: "18+" },
                    { key: "limited", label: "Лимитированные" },
                    { key: "common", label: "Обычные" },
                    { key: "replica", label: "Реплики" },
                    { key: "hotPrice", label: "Горячая цена" },
                    { key: "novelties", label: "Новинки" },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleType(key as keyof typeof typeFilter)}
                      className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        typeFilter[key as keyof typeof typeFilter]
                          ? "border-violet-400/70 bg-violet-500/15 text-violet-100"
                          : "border-white/10 bg-white/5 text-zinc-300 hover:border-violet-400/30 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="overflow-visible rounded-2xl border border-white/[0.07] bg-gradient-to-br from-zinc-950/95 via-zinc-950/80 to-violet-950/[0.35] p-4 shadow-[0_0_56px_-20px_rgba(88,28,135,0.4)] sm:p-6 lg:p-8 xl:p-9">
          <div className="grid gap-7 overflow-visible md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:items-start md:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10 xl:gap-12">
          <div className="order-1 -mt-1 min-w-0 overflow-visible px-0 sm:-mt-2 sm:px-1 md:sticky md:top-16 lg:top-20">
            <CardProductGallery card={card} browseCards={galleryBrowseCards} />
          </div>

          <div className="order-2 flex min-w-0 flex-col pt-1 md:max-w-none md:pt-0 lg:pr-1">
            <div className="mb-3 flex flex-wrap gap-1.5">
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${RARITY_BADGE[rarityUi]}`}
              >
                {rarityLine}
              </span>
              {card.isNew ? (
                <span className="inline-flex items-center rounded-full border border-emerald-400/45 bg-emerald-950/60 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-100">
                  Новинка
                </span>
              ) : null}
              {inStock ? (
                <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-950/50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200">
                  В наличии
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-rose-500/40 bg-rose-950/50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-200">
                  Уже раскупили
                </span>
              )}
            </div>

            <h1 className="mb-2 text-2xl font-bold leading-tight text-white sm:text-[1.65rem] md:text-3xl xl:text-[2rem]">
              {card.title}
            </h1>

            <div className="mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-400 sm:text-sm">
              <Link
                href={`/#${collectionSectionId(card.category)}`}
                className="font-medium text-violet-300/95 transition hover:text-violet-200 hover:underline"
              >
                {card.category}
              </Link>
              {card.subcategory?.trim() ? (
                <span className="text-zinc-500">· {card.subcategory.trim()}</span>
              ) : null}
              {card.effect ? (
                <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs uppercase tracking-wide text-zinc-400">
                  {card.effect === "3d-horizontal"
                    ? "3D"
                    : card.effect === "morphing"
                      ? "Morphing"
                      : card.effect}
                </span>
              ) : null}
            </div>

            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              <CardRatingStars value={merged.avg} compact />
              <span className="text-base font-semibold tabular-nums text-amber-200 sm:text-[0.95rem]">
                {merged.avg.toFixed(1)}
              </span>
              <span className="text-xs text-zinc-500 sm:text-sm">
                {merged.totalCount}{" "}
                {ratingCountWord(merged.totalCount)}
              </span>
            </div>

            <div className="mb-4">
              <InteractiveRating cardId={card.id} compact />
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900/60 px-2.5 py-1.5 text-[11px] text-zinc-200">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                Лучшее качество
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900/60 px-2.5 py-1.5 text-[11px] text-zinc-200">
                <Truck className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                Быстрая доставка
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900/60 px-2.5 py-1.5 text-[11px] text-zinc-200">
                <BadgePercent className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                Хорошая цена
              </div>
            </div>

            <CardPriceDualRow card={card} variant="product" />

            <div className="mb-6 flex w-full max-w-xl flex-col gap-2.5 sm:max-w-none sm:flex-row sm:gap-3">
              <button
                type="button"
                disabled={!inStock}
                onClick={() => {
                  const source = document.querySelector("[data-cart-fly-source]");
                  addToCartWithFeedback(card, source as HTMLElement | null);
                }}
                className="w-full rounded-xl border border-purple-500/45 bg-purple-950/40 px-4 py-2.5 text-sm font-semibold text-purple-100 transition hover:border-purple-400/55 hover:bg-purple-900/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                В корзину
              </button>
              <button
                type="button"
                onClick={onFavoriteClick}
                aria-pressed={liked}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition sm:min-w-[160px] ${
                  liked
                    ? "border border-rose-500/50 bg-rose-950/50 text-rose-100 shadow-[0_0_24px_rgba(244,63,94,0.2)] ring-1 ring-rose-400/35 hover:bg-rose-950/70"
                    : "border border-white/15 bg-zinc-900/80 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-rose-500/40 hover:bg-zinc-800/90 hover:text-white"
                }`}
              >
                <Heart
                  className={`h-4 w-4 shrink-0 ${liked ? "fill-rose-400 text-rose-400" : "text-zinc-300"}`}
                  aria-hidden
                />
                {liked ? "В избранном" : "В избранное"}
              </button>
            </div>

            <section className="mb-6 rounded-xl border border-white/[0.06] bg-black/20 p-4 sm:p-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Описание
              </h2>
              <div className="max-w-none text-sm leading-relaxed text-zinc-300 sm:text-[0.9375rem]">
                <CardDescriptionText
                  text={card.description}
                  fallback="Описание появится позже."
                />
              </div>
            </section>

            <ProductReviewsSection
              cardId={card.id}
              cardCategory={card.category}
              mergedAvg={merged.avg}
              mergedTotalCount={merged.totalCount}
              adminReviews={adminReviews}
              userReviews={userReviews}
              onUserReviewsRefresh={refreshUserReviews}
            />
          </div>
        </div>
        </div>

        {moreFromCategory.length > 0 ? (
          <CardMiniRail
            title={`Ещё из категории «${card.category}»`}
            cards={moreFromCategory}
          />
        ) : null}
      </div>
    </>
  );
}
