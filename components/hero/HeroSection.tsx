"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { StoredCard } from "@/app/api/cards/route";
import type { CategoryTile } from "@/app/lib/categoriesJson";
import { apiUrl } from "@/app/lib/apiUrl";
import {
  ultraOrHeroBgUrl,
  ultraOrHeroBgUrlForCategoryName,
} from "@/app/lib/cardUltraBg";
import { collectionSectionId } from "@/app/lib/collectionAnchor";
import { categoryFocusToStyle } from "@/app/lib/imageFocus";
import type { SpotlightSlideRow } from "@/app/lib/spotlightJson";
import { DEFAULT_SPOTLIGHT_SLIDES } from "@/app/lib/spotlightJson";
import {
  PRODUCT_CARD_NAV_ARROW_CLASS,
  ProductCardNavArrowIcon,
} from "@/app/components/card-showcase/CardViewer";
import { HeroCardCommerce } from "./HeroCardCommerce";
import { HeroCardStack } from "./HeroCardStack";
import { HeroIlluCardsLogo } from "./HeroIlluCardsLogo";
import { PromoSpotlightPanel } from "./PromoSpotlightPanel";
import {
  HERO_CARD_STACK_WIDTH_MATCH_CLASS,
  HERO_CARD_STACK_WIDTH_NOVELTY_NARROW_CLASS,
} from "./heroCardStackClasses";

/** Горизонтальный жест мышью по стопке «Новинки» (на таче только стрелки — см. обработчики). */
const NOVELTY_SWIPE_MIN_PX = 56;

type Props = {
  cards: StoredCard[];
  /** Категория `cards[0]` с сервера — до ответа `/api/categories` фильтр героя совпадает с SSR. */
  initialHeroCategoryName: string | null;
  /** Слайды витрины (редактируются в /admin/spotlight). */
  initialSpotlightSlides: SpotlightSlideRow[];
  /** Плашки категорий в герое — с сервера, чтобы показывались даже если fetch на клиенте не сработал (Telegram, блокировки). */
  initialCategories?: CategoryTile[];
  /** Ужать герой по вертикали (главная «в один экран»). */
  viewportCompact?: boolean;
};

export default function HeroSection({
  cards,
  initialHeroCategoryName,
  initialSpotlightSlides,
  initialCategories = [],
  viewportCompact = false,
}: Props) {
  const router = useRouter();
  const heroCardFlyRef = useRef<HTMLDivElement>(null);
  const noveltyDragStartRef = useRef<{ x: number; y: number } | null>(null);
  /** После свайпа гасим синтетический click по `<Link>` на карточке. */
  const blockHeroCardLinkClickRef = useRef(false);
  const [spotlightSlides, setSpotlightSlides] = useState<SpotlightSlideRow[]>(
    () =>
      initialSpotlightSlides.length > 0
        ? initialSpotlightSlides
        : DEFAULT_SPOTLIGHT_SLIDES
  );
  const [apiCategories, setApiCategories] = useState<CategoryTile[]>(
    () => initialCategories
  );
  /** Явный выбор в слайдере; до клика используем `autoCategoryName`. */
  const [userSelectedCategory, setUserSelectedCategory] = useState<
    string | null
  >(null);

  useEffect(() => {
    fetch(apiUrl("/api/categories"))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setApiCategories(data as CategoryTile[]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/spotlight"))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: unknown) => {
        if (cancelled) return;
        if (
          data &&
          typeof data === "object" &&
          "slides" in data &&
          Array.isArray((data as { slides: unknown }).slides) &&
          (data as { slides: SpotlightSlideRow[] }).slides.length > 0
        ) {
          setSpotlightSlides((data as { slides: SpotlightSlideRow[] }).slides);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const autoCategoryName = useMemo(() => {
    if (!apiCategories.length || !cards.length) return null;
    const match = apiCategories.find((cat) =>
      cards.some((c) => (c.category?.trim() ?? "") === cat.name.trim())
    );
    return match?.name ?? apiCategories[0].name;
  }, [apiCategories, cards]);

  const selectedCategoryName =
    userSelectedCategory ?? autoCategoryName ?? initialHeroCategoryName;

  const filteredCards = useMemo(() => {
    if (!selectedCategoryName) return cards;
    const n = selectedCategoryName.trim();
    return cards.filter((c) => (c.category?.trim() ?? "") === n);
  }, [cards, selectedCategoryName]);

  const displayCard = filteredCards[0] ?? cards[0] ?? null;

  const [spotlightSlide, setSpotlightSlide] = useState(0);
  const [noveltyIndex, setNoveltyIndex] = useState(0);

  const safeSpotlightIndex = Math.min(
    spotlightSlide,
    Math.max(0, spotlightSlides.length - 1)
  );
  const currentSpotlightSlide = spotlightSlides[safeSpotlightIndex];
  const isNoveltiesSlide = currentSpotlightSlide?.kind === "novelties";

  const noveltiesCards = useMemo(() => {
    if (!currentSpotlightSlide || currentSpotlightSlide.kind !== "novelties") {
      return [];
    }
    const ids = currentSpotlightSlide.cardIds?.filter(Boolean) ?? [];
    if (ids.length > 0) {
      const map = new Map(cards.map((c) => [c.id, c]));
      return ids.map((id) => map.get(id)).filter((c): c is StoredCard =>
        Boolean(c)
      );
    }
    return cards.filter((c) => c.isNew || c.rarity === "novelty");
  }, [cards, currentSpotlightSlide]);

  useEffect(() => {
    setSpotlightSlide((i) =>
      Math.min(i, Math.max(0, spotlightSlides.length - 1))
    );
  }, [spotlightSlides.length]);

  useEffect(() => {
    setNoveltyIndex(0);
  }, [safeSpotlightIndex]);

  useEffect(() => {
    setNoveltyIndex((i) => {
      if (noveltiesCards.length === 0) return 0;
      return Math.min(i, noveltiesCards.length - 1);
    });
  }, [noveltiesCards.length]);

  const focusCard = useMemo((): StoredCard | null => {
    if (!displayCard) return null;
    /** На слайде «Новинки» всегда крутим список новинок витрины, даже если выбрана плашка категории. */
    if (isNoveltiesSlide && noveltiesCards.length > 0) {
      return noveltiesCards[noveltyIndex % noveltiesCards.length]!;
    }
    return displayCard;
  }, [displayCard, isNoveltiesSlide, noveltiesCards, noveltyIndex]);

  /** Витрина без «пустой» карточки: первый кандидат с непустым лицом. */
  const heroShowcaseCard = useMemo((): StoredCard | null => {
    const ok = (c: StoredCard | null | undefined) =>
      c && c.frontImage?.trim() ? c : null;
    return (
      ok(focusCard) ??
      ok(displayCard) ??
      noveltiesCards.find((c) => ok(c)) ??
      filteredCards.find((c) => ok(c)) ??
      cards.find((c) => ok(c)) ??
      null
    );
  }, [focusCard, displayCard, noveltiesCards, filteredCards, cards]);

  const noCardsInCategory =
    selectedCategoryName != null &&
    filteredCards.length === 0 &&
    cards.length > 0;

  const showNoveltiesHeroChrome = isNoveltiesSlide;

  const canCycleNoveltiesWithArrows =
    isNoveltiesSlide && noveltiesCards.length > 1;

  const stepNoveltyIndex = useCallback(
    (delta: number) => {
      if (!isNoveltiesSlide || noveltiesCards.length < 2) return;
      setNoveltyIndex((i) => {
        const n = noveltiesCards.length;
        return (i + delta + n * 16) % n;
      });
    },
    [isNoveltiesSlide, noveltiesCards.length]
  );

  const onNoveltyArrowKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (!isNoveltiesSlide || noveltiesCards.length < 2) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepNoveltyIndex(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        stepNoveltyIndex(1);
      }
    },
    [isNoveltiesSlide, noveltiesCards.length, stepNoveltyIndex]
  );

  const applyNoveltySwipeFromDelta = useCallback(
    (start: { x: number; y: number }, endX: number, endY: number) => {
      if (!isNoveltiesSlide || noveltiesCards.length < 2) {
        return;
      }
      const dx = endX - start.x;
      const dy = endY - start.y;
      if (
        Math.abs(dx) < NOVELTY_SWIPE_MIN_PX ||
        Math.abs(dx) < Math.abs(dy)
      ) {
        return;
      }
      blockHeroCardLinkClickRef.current = true;
      if (dx < 0) {
        setNoveltyIndex((i) => (i + 1) % noveltiesCards.length);
      } else {
        setNoveltyIndex(
          (i) => (i - 1 + noveltiesCards.length) % noveltiesCards.length
        );
      }
    },
    [isNoveltiesSlide, noveltiesCards.length]
  );

  const onNoveltyPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      if (e.button !== 0) return;
      if (!isNoveltiesSlide || noveltiesCards.length < 2) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target?.closest?.(
          "[data-novelty-hero-chrome], [data-hero-novelty-flank-nav]"
        )
      )
        return;
      noveltyDragStartRef.current = { x: e.clientX, y: e.clientY };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [isNoveltiesSlide, noveltiesCards.length]
  );

  const onNoveltyPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const start = noveltyDragStartRef.current;
      noveltyDragStartRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (!start) return;
      applyNoveltySwipeFromDelta(start, e.clientX, e.clientY);
    },
    [applyNoveltySwipeFromDelta]
  );

  const onNoveltyPointerCancel = useCallback(() => {
    noveltyDragStartRef.current = null;
  }, []);

  /**
   * Третий слой: если в полоске выбрана одна категория, а карусель «Новинки»
   * показывает карточку из другой — фон как у линии полоски (первый представитель или статика).
   */
  const ultraBgUrl = useMemo(() => {
    const cardForBg = heroShowcaseCard ?? focusCard;
    if (!cardForBg) return "";
    const strip = (selectedCategoryName ?? "").trim();
    const fc = (cardForBg.category ?? "").trim();
    if (strip && fc && strip !== fc) {
      if (displayCard && (displayCard.category ?? "").trim() === strip) {
        return ultraOrHeroBgUrl(displayCard);
      }
      return ultraOrHeroBgUrlForCategoryName(strip);
    }
    return ultraOrHeroBgUrl(cardForBg);
  }, [selectedCategoryName, heroShowcaseCard, focusCard, displayCard]);

  if (cards.length === 0) {
    return (
      <div
        className={`relative flex flex-col items-center justify-center px-6 py-8 ${
          viewportCompact
            ? "min-h-0 flex-1"
            : "mb-12 min-h-[600px] py-16"
        }`}
      >
        <p className="relative z-10 text-lg text-zinc-400">
          Пока нет карточек в каталоге.
        </p>
      </div>
    );
  }

  if (!displayCard || !focusCard) {
    return null;
  }

  const stackCard = heroShowcaseCard ?? focusCard;

  return (
    <div
      className={`relative z-0 w-full overflow-visible pt-0 ${
        viewportCompact
          ? "hero-viewport-compact mb-0 flex min-h-0 min-w-0 flex-1 flex-col pb-0"
          : "mb-12 pb-[clamp(1rem,2.5vw,2rem)]"
      }`}
    >
      {/* Как на макете: та же сетка, что у хедера — max-w-[1400px] + px-6 lg:px-10 */}
      <div
        className={`relative z-0 mx-auto min-h-0 w-full max-w-[1400px] overflow-visible ${
          viewportCompact ? "flex min-h-0 min-w-0 flex-1 flex-col" : ""
        }`}
      >
        <section
          className={`relative z-20 overflow-visible rounded-2xl bg-transparent ${
            viewportCompact ? "flex min-h-0 min-w-0 flex-1 flex-col" : ""
          }`}
          aria-label="Витрина: логотип IlluCards, категории, подборки и карточка"
        >
          <div
            className={`flex flex-col px-[clamp(1rem,3.5vw,2.5rem)] ${
              viewportCompact
                ? "min-h-0 flex-1 gap-2 pb-2 pt-2 sm:gap-2.5 sm:pb-3 sm:pt-2.5 lg:gap-3 lg:pb-3 lg:pt-3"
                : "gap-5 pb-10 pt-5 sm:gap-6 sm:pb-12 sm:pt-6 lg:gap-7 lg:pb-14 lg:pt-8"
            }`}
          >
            {/* 1. Логотип */}
            <div className="min-w-0 w-full shrink-0">
              <HeroIlluCardsLogo />
            </div>

            {/* 2–3. Категории + блок витрины/карточки: на lg+ как в макете; ≤768 — сетка «категории слева | карточка + витрина» (globals) */}
            <div className="hero-body min-w-0 w-full">
            <div
              className={`hero-categories-outer relative z-30 w-full min-w-0 ${
                viewportCompact ? "pb-2 sm:pb-2.5" : "pb-4 sm:pb-5"
              }`}
            >
              <div
                className={`hero-categories relative flex min-w-0 w-full justify-start overflow-x-auto overflow-y-visible py-0.5 scrollbar-hide ${
                  viewportCompact
                    ? "min-h-[2.75rem] gap-1.5 sm:min-h-12 sm:gap-2"
                    : "min-h-[clamp(3.25rem,16vw,5rem)] gap-2 sm:gap-2.5 max-[768px]:min-h-0"
                }`}
              >
              {apiCategories.map((cat) => {
                const selected =
                  selectedCategoryName != null &&
                  cat.name.trim() === selectedCategoryName.trim();
                const plateSrc = (cat.plateImage?.trim() || cat.image || "").trim();
                const plateFocus = cat.plateImage?.trim()
                  ? cat.plateImageFocus
                  : cat.imageFocus;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => {
                      setUserSelectedCategory(cat.name);
                      router.push(`/#${collectionSectionId(cat.name)}`);
                    }}
                    aria-label={cat.name}
                    aria-current={selected}
                    className={[
                      "category-item group relative shrink-0 cursor-pointer overflow-hidden rounded-xl bg-zinc-950",
                      viewportCompact
                        ? "h-11 w-11 max-h-12 max-w-12 sm:h-12 sm:w-12 max-[768px]:!h-[50px] max-[768px]:!w-[50px] max-[768px]:!max-h-[50px] max-[768px]:!max-w-[50px]"
                        : "h-[clamp(3.25rem,16vw,5rem)] w-[clamp(3.25rem,16vw,5rem)] max-h-[5rem] max-w-[5rem] max-[768px]:!h-[50px] max-[768px]:!w-[50px] max-[768px]:!max-h-[50px] max-[768px]:!max-w-[50px]",
                      "will-change-transform [transform:translateZ(0)]",
                      "transition-transform duration-300 ease-out",
                      "hover:scale-[1.08] active:scale-[1.04]",
                      "hover:shadow-xl hover:shadow-zinc-500/25",
                      selected ? "ring-2 ring-inset ring-zinc-400" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {plateSrc ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={plateSrc}
                          alt=""
                          className="category-tile-img rounded-[inherit]"
                          style={categoryFocusToStyle(plateFocus)}
                          draggable={false}
                        />
                      </div>
                    ) : (
                      <div
                        className="h-full w-full rounded-xl bg-zinc-800"
                        aria-hidden
                      />
                    )}

                    <div className="hero-category-label pointer-events-none absolute bottom-1 left-1 right-1 z-10 text-center font-semibold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95),0_0_8px_rgba(0,0,0,0.65)]">
                      {cat.name}
                    </div>
                  </button>
                );
              })}
              </div>
            </div>

            <div className="hero-main-column min-w-0">
            {noCardsInCategory ? (
              <p className="hero-category-empty-msg text-center text-sm text-amber-400/90">
                В категории «{selectedCategoryName}» пока нет карточек — показана
                первая доступная.
              </p>
            ) : null}

            {/*
              Десктоп: 12 колонок — витрина слева (7), карточка справа (5). ≤768: колонка справа — карточка, затем витрина (flex в globals).
            */}
            <div
              className={`hero-main-grid relative z-0 grid grid-cols-1 items-start overflow-x-clip pb-0 max-[768px]:overflow-x-visible lg:grid-cols-12 lg:gap-y-0 lg:overflow-visible ${
                viewportCompact
                  ? "mt-1 min-h-0 flex-1 gap-4 sm:mt-1.5 sm:gap-5 lg:mt-2 lg:gap-x-5 xl:gap-x-6"
                  : "mt-2 gap-9 sm:mt-3 sm:gap-10 lg:mt-4 lg:gap-x-8 xl:gap-x-10"
              }`}
            >
              <div className="hero-cell-spotlight hero-info relative z-10 order-2 min-h-0 min-w-0 lg:order-1 lg:col-span-7">
                <PromoSpotlightPanel
                  embedded
                  compact={viewportCompact}
                  slides={spotlightSlides}
                  slideIndex={spotlightSlide}
                  onSlideChange={setSpotlightSlide}
                  noveltyTotal={noveltiesCards.length}
                  commerceFooter={
                    <HeroCardCommerce
                      variant="noveltiesBlock"
                      card={stackCard}
                      flySourceRef={heroCardFlyRef}
                      onOpenCard={() => router.push(`/card/${stackCard.id}`)}
                    />
                  }
                />
              </div>

              {/* z выше колонки витрины (z-10): иначе при overflow/transform левый блок перекрывает карточку */}
              <div
                className={`hero-cell-card hero-card relative z-20 order-1 flex w-full min-w-0 flex-col justify-start max-[768px]:mt-0 max-[768px]:mb-0 lg:order-2 lg:col-span-5 lg:justify-self-stretch ${
                  viewportCompact ? "min-h-0 lg:min-h-0" : "lg:min-h-0"
                } ${
                  showNoveltiesHeroChrome
                    ? "items-center -mt-16 sm:-mt-24 lg:-mt-40 xl:-mt-44 max-[768px]:!mt-0 max-[768px]:!mb-0 max-[768px]:items-center"
                    : "items-center lg:items-end"
                }`}
              >
                <div
                  ref={heroCardFlyRef}
                  onPointerDown={onNoveltyPointerDown}
                  onPointerUp={onNoveltyPointerUp}
                  onPointerCancel={onNoveltyPointerCancel}
                  onClickCapture={(e) => {
                    if (!blockHeroCardLinkClickRef.current) return;
                    e.preventDefault();
                    e.stopPropagation();
                    blockHeroCardLinkClickRef.current = false;
                  }}
                  className={`relative z-[15] grid w-full min-h-0 min-w-0 touch-pan-y overflow-visible px-0 pt-0 [&>div]:max-w-full ${
                    viewportCompact
                      ? showNoveltiesHeroChrome
                        ? "gap-2 pb-0 sm:gap-2.5 -translate-y-4 sm:-translate-y-5 max-[768px]:translate-y-0 max-[768px]:gap-y-6"
                        : "gap-1.5 pb-0 sm:gap-2 max-[768px]:translate-y-0"
                      : showNoveltiesHeroChrome
                        ? "gap-3 pb-0 sm:gap-4 lg:gap-5 -translate-y-6 sm:-translate-y-7 lg:-translate-y-9 max-[768px]:translate-y-0 max-[768px]:gap-y-8"
                        : "gap-3 pb-1 sm:gap-3.5 max-[768px]:translate-y-0"
                  } ${
                    showNoveltiesHeroChrome
                      ? "max-w-[min(100%,40rem)] justify-items-center max-[768px]:max-w-full"
                      : "max-w-full justify-items-center lg:justify-items-end"
                  }`}
                >
                  {showNoveltiesHeroChrome ? (
                    <div
                      role="group"
                      aria-label="Новинки"
                      className="flex w-full max-w-full flex-col items-center"
                    >
                      <div
                        data-novelty-hero-chrome
                        className="w-full max-w-full -translate-y-4 sm:-translate-y-5 lg:-translate-y-6 translate-x-6 sm:translate-x-8 lg:translate-x-10 xl:translate-x-12 max-[768px]:translate-x-0 max-[768px]:translate-y-0"
                      >
                        <h2
                          className={`hero-wordmark-shine hero-wordmark-shine--mirror mx-auto block w-full max-w-full origin-center text-balance text-center font-bold uppercase tracking-[0.1em] drop-shadow-[0_1px_0_rgba(0,0,0,0.5),0_8px_28px_rgba(109,40,217,0.35)] transition-transform duration-300 ease-out hover:scale-[1.04] motion-reduce:transition-none motion-reduce:hover:scale-100 ${
                            viewportCompact
                              ? "text-xl leading-tight sm:text-2xl lg:text-[1.5rem]"
                              : "text-3xl leading-none sm:text-4xl lg:text-[2.35rem] xl:text-[2.65rem] lg:leading-none"
                          }`}
                        >
                          Новинки
                        </h2>
                      </div>
                    </div>
                  ) : null}
                  {showNoveltiesHeroChrome ? (
                    <div className="flex w-full min-w-0 max-w-full items-center justify-center gap-x-2 overflow-visible sm:gap-x-2.5 max-[768px]:gap-x-1">
                      <div className="flex shrink-0 justify-end">
                        {canCycleNoveltiesWithArrows ? (
                          <button
                            type="button"
                            data-hero-novelty-flank-nav
                            aria-label="Предыдущая новинка"
                            onClick={() => stepNoveltyIndex(-1)}
                            onKeyDown={onNoveltyArrowKeyDown}
                            className={PRODUCT_CARD_NAV_ARROW_CLASS}
                          >
                            <ProductCardNavArrowIcon direction="prev" />
                          </button>
                        ) : (
                          <span
                            data-hero-novelty-flank-nav
                            className={`${PRODUCT_CARD_NAV_ARROW_CLASS} pointer-events-none cursor-not-allowed opacity-35`}
                            aria-hidden
                          >
                            <ProductCardNavArrowIcon direction="prev" />
                          </span>
                        )}
                      </div>
                      <div
                        className={`flex min-h-0 min-w-0 flex-1 justify-center ${HERO_CARD_STACK_WIDTH_NOVELTY_NARROW_CLASS} translate-x-6 sm:translate-x-8 lg:translate-x-10 xl:translate-x-12 max-[768px]:max-w-[min(100%,min(26.5rem,calc(100vw-4.25rem)))] max-[768px]:translate-x-0`}
                      >
                        <HeroCardStack
                          displayCard={stackCard}
                          ultraBgUrl={ultraBgUrl}
                          noveltyNarrow
                        />
                      </div>
                      <div className="flex shrink-0 justify-start">
                        {canCycleNoveltiesWithArrows ? (
                          <button
                            type="button"
                            data-hero-novelty-flank-nav
                            aria-label="Следующая новинка"
                            onClick={() => stepNoveltyIndex(1)}
                            onKeyDown={onNoveltyArrowKeyDown}
                            className={PRODUCT_CARD_NAV_ARROW_CLASS}
                          >
                            <ProductCardNavArrowIcon direction="next" />
                          </button>
                        ) : (
                          <span
                            data-hero-novelty-flank-nav
                            className={`${PRODUCT_CARD_NAV_ARROW_CLASS} pointer-events-none cursor-not-allowed opacity-35`}
                            aria-hidden
                          >
                            <ProductCardNavArrowIcon direction="next" />
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <HeroCardStack
                      displayCard={stackCard}
                      ultraBgUrl={ultraBgUrl}
                    />
                  )}
                </div>
              </div>
            </div>
            </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
