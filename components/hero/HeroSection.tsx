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
import { buildNoveltiesCarouselCards } from "@/app/lib/noveltiesHeroCarousel";
import { EMPTY_TYPE_FILTER } from "@/app/lib/collectionFilter";
import { useCatalogFilter } from "@/app/context/CatalogFilterContext";
import type { SpotlightSlideRow } from "@/app/lib/spotlightJson";
import { DEFAULT_SPOTLIGHT_SLIDES } from "@/app/lib/spotlightJson";
import {
  CardViewer,
  PRODUCT_CARD_NAV_ARROW_CLASS,
  ProductCardNavArrowIcon,
} from "@/app/components/card-showcase/CardViewer";
import { HeroCatalogCardFooter } from "./HeroCatalogCardFooter";
import { HeroCardCommerce } from "./HeroCardCommerce";
import { HeroIlluCardsLogo } from "./HeroIlluCardsLogo";
import { PromoSpotlightPanel } from "./PromoSpotlightPanel";

/** Горизонтальный жест мышью по стопке «Новинки» (на таче только стрелки — см. обработчики). */
const NOVELTY_SWIPE_MIN_PX = 56;

/** Автосмена карточки в блоке «Новинки» (стрелки и ручной свайп по-прежнему доступны). */
const NOVELTY_AUTO_ADVANCE_MS = 5500;

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
  const {
    setSearch,
    setCategoryFilter,
    setTypeFilter,
    setPriceSort,
    openFiltersAndScrollToCollection,
  } = useCatalogFilter();
  const heroCardFlyRef = useRef<HTMLDivElement>(null);
  const noveltyDragStartRef = useRef<{ x: number; y: number } | null>(null);
  /** После свайпа гасим синтетический click по `<Link>` на карточке. */
  const blockHeroCardLinkClickRef = useRef(false);

  const openNoveltiesSection = useCallback(() => {
    setSearch("");
    setCategoryFilter("");
    setTypeFilter({ ...EMPTY_TYPE_FILTER, novelties: true });
    setPriceSort("default");
    openFiltersAndScrollToCollection();
  }, [openFiltersAndScrollToCollection, setSearch, setCategoryFilter, setTypeFilter, setPriceSort]);
  /** Пауза автолистания при наведении на колонку «Новинки». */
  const noveltyAutoPausedRef = useRef(false);
  const noveltiesLenRef = useRef(0);
  const [spotlightSlides, setSpotlightSlides] = useState<SpotlightSlideRow[]>(
    () =>
      initialSpotlightSlides.length > 0
        ? initialSpotlightSlides
        : DEFAULT_SPOTLIGHT_SLIDES
  );
  const [isMobileHeroLayout, setIsMobileHeroLayout] = useState(false);
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
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobileHeroLayout(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
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

  const noveltiesCards = useMemo(
    () => buildNoveltiesCarouselCards(cards, currentSpotlightSlide),
    [cards, currentSpotlightSlide]
  );

  const heroBrowseNonNovelty = useMemo(
    () => (filteredCards.length > 0 ? filteredCards : cards),
    [filteredCards, cards]
  );

  const onNoveltyBrowseNavigate = useCallback(
    (nextId: string) => {
      const j = noveltiesCards.findIndex((c) => c.id === nextId);
      if (j >= 0) setNoveltyIndex(j);
    },
    [noveltiesCards]
  );

  useEffect(() => {
    noveltiesLenRef.current = noveltiesCards.length;
  }, [noveltiesCards.length]);

  useEffect(() => {
    if (!isNoveltiesSlide || noveltiesCards.length < 2) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const tick = () => {
      if (noveltyAutoPausedRef.current) return;
      if (document.visibilityState !== "visible") return;
      const n = noveltiesLenRef.current;
      if (n < 2) return;
      setNoveltyIndex((i) => (i + 1) % n);
    };

    const id = window.setInterval(tick, NOVELTY_AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [isNoveltiesSlide, noveltiesCards.length, safeSpotlightIndex]);

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

  const onNoveltyAutoPauseEnter = useCallback(() => {
    noveltyAutoPausedRef.current = true;
  }, []);

  const onNoveltyAutoPauseLeave = useCallback(() => {
    noveltyAutoPausedRef.current = false;
  }, []);

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
            : "mb-12 min-h-[clamp(20rem,55vh,37.5rem)] py-16"
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
  const stackCategoryLower = (stackCard.category ?? "").trim().toLowerCase();
  const isMarvelHeroCard = stackCategoryLower === "marvel";
  const isTmntHeroCard = stackCategoryLower === "tmnt";

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
            className={`hero min-w-0 ${
              viewportCompact ? "hero--compact min-h-0 flex-1" : ""
            }`}
          >
            <div className="hero-stage min-w-0 w-full">
            {/* 1. Логотип — на широком экране та же строка сетки, что верх правой колонки (см. .hero-stage в globals). */}
            <div className="hero-wordmark-row min-w-0 w-full shrink-0">
              <HeroIlluCardsLogo />
            </div>

            {/* 2–3. Десктоп: слева категории + витрина, справа карточка. ≤768 — см. globals. */}
            <div className="hero-body min-w-0 w-full">
              <div
                className={`hero-main-desktop min-w-0 w-full ${
                  viewportCompact ? "min-h-0 flex-1" : ""
                }`}
              >
                <div className="hero-left-side min-w-0">
                  <div className="categories hero-categories-outer relative z-30 w-full min-w-0">
                    <div className="hero-categories hero-categories-strip relative flex min-w-0 w-full justify-start overflow-x-auto overflow-y-visible py-0.5 scrollbar-hide">
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
                      "category-item group shrink-0 cursor-pointer overflow-hidden rounded-xl bg-zinc-950",
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
                      <div className="category-tile-wrap">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={plateSrc}
                          alt=""
                          className="category-tile-img h-full w-full max-h-full max-w-full rounded-[inherit] object-contain"
                          style={categoryFocusToStyle(plateFocus)}
                          draggable={false}
                        />
                      </div>
                    ) : (
                      <div
                        className="category-tile-wrap rounded-[inherit] bg-zinc-800"
                        aria-hidden
                      />
                    )}

                    <div className="hero-category-label z-10 text-center leading-tight">
                      {cat.name}
                    </div>
                  </button>
                );
              })}
                    </div>
                  </div>

                  {noCardsInCategory ? (
                    <p className="hero-category-empty-msg text-center text-sm text-amber-400/90">
                      В категории «{selectedCategoryName}» пока нет карточек —
                      показана первая доступная.
                    </p>
                  ) : null}

                  <div className="hero-cell-spotlight hero-info hero-left-spotlight relative z-10 min-h-0 min-w-0 w-full max-w-full">
                    <PromoSpotlightPanel
                      embedded
                      compact={viewportCompact}
                      slides={spotlightSlides}
                      slideIndex={spotlightSlide}
                      onSlideChange={setSpotlightSlide}
                      noveltyTotal={noveltiesCards.length}
                      noveltiesLeftEmpty={
                        showNoveltiesHeroChrome && !isMobileHeroLayout
                      }
                      commerceFooter={
                        showNoveltiesHeroChrome && !isMobileHeroLayout ? (
                          undefined
                        ) : (
                          <HeroCardCommerce
                            variant="noveltiesBlock"
                            card={stackCard}
                            flySourceRef={heroCardFlyRef}
                            onOpenCard={() =>
                              router.push(`/card/${stackCard.id}`)
                            }
                          />
                        )
                      }
                    />
                  </div>
                </div>

                <div
                  className={[
                    "hero-content hero-right-side min-w-0",
                    showNoveltiesHeroChrome ? "hero-right-side--novelty" : "",
                    isMarvelHeroCard ? "hero-right-side--marvel" : "",
                    isTmntHeroCard ? "hero-right-side--tmnt" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div
                    className={[
                      "hero-cell-card hero-card relative z-20 flex w-full min-w-0 max-w-full flex-col justify-start",
                      viewportCompact ? "min-h-0" : "",
                      showNoveltiesHeroChrome
                        ? "hero-card--novelty-overlap items-start"
                        : "items-end",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onMouseEnter={
                      showNoveltiesHeroChrome
                        ? onNoveltyAutoPauseEnter
                        : undefined
                    }
                    onMouseLeave={
                      showNoveltiesHeroChrome
                        ? onNoveltyAutoPauseLeave
                        : undefined
                    }
                  >
                  {showNoveltiesHeroChrome ? (
                    <div className="hero-right-product flex w-full max-w-none min-w-0 flex-col items-center gap-0 overflow-visible py-0 md:gap-4 md:py-0">
                      <div className="hero-novelties-mobile-stack flex w-full max-w-full flex-col items-stretch gap-3 max-md:w-full max-md:px-0 md:contents md:max-w-none">
                      <div className="hero-title hero-novelty-header w-full shrink-0 text-center">
                        <h2 className="hero-novelties-title hero-novelties-title--static mx-auto block w-full max-w-full origin-center text-balance text-center font-bold uppercase tracking-[0.1em]">
                          Новинки
                        </h2>
                      </div>

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
                        className="hero-slider hero-novelty-card-shell relative flex w-full max-w-full shrink-0 items-center justify-center gap-2 px-0 md:max-w-[min(100%,40rem)] md:gap-3 md:px-2"
                      >
                        {canCycleNoveltiesWithArrows ? (
                          <button
                            type="button"
                            data-hero-novelty-flank-nav
                            aria-label="Предыдущая новинка"
                            onClick={() => stepNoveltyIndex(-1)}
                            onKeyDown={onNoveltyArrowKeyDown}
                            className={`arrow arrow--left hero-novelty-side-arrow hero-novelty-arrow--prev ${PRODUCT_CARD_NAV_ARROW_CLASS}`}
                          >
                            <ProductCardNavArrowIcon direction="prev" />
                          </button>
                        ) : (
                          <span
                            data-hero-novelty-flank-nav
                            className={`arrow arrow--left hero-novelty-side-arrow hero-novelty-arrow--prev ${PRODUCT_CARD_NAV_ARROW_CLASS} pointer-events-none cursor-not-allowed opacity-35`}
                            aria-hidden
                          >
                            <ProductCardNavArrowIcon direction="prev" />
                          </span>
                        )}

                        <div className="hero-card hero-novelty-card-wrap flex-1 min-w-0">
                          <CardViewer
                            layout="product"
                            activeCard={stackCard}
                            browseCards={noveltiesCards}
                            onNavigate={onNoveltyBrowseNavigate}
                            hideNavigation
                            productCenterConstrained={true}
                            onCardClick={(cardId) => router.push(`/card/${cardId}`)}
                          />
                        </div>

                        {canCycleNoveltiesWithArrows ? (
                          <button
                            type="button"
                            data-hero-novelty-flank-nav
                            aria-label="Следующая новинка"
                            onClick={() => stepNoveltyIndex(1)}
                            onKeyDown={onNoveltyArrowKeyDown}
                            className={`arrow arrow--right hero-novelty-side-arrow hero-novelty-arrow--next ${PRODUCT_CARD_NAV_ARROW_CLASS}`}
                          >
                            <ProductCardNavArrowIcon direction="next" />
                          </button>
                        ) : (
                          <span
                            data-hero-novelty-flank-nav
                            className={`arrow arrow--right hero-novelty-side-arrow hero-novelty-arrow--next ${PRODUCT_CARD_NAV_ARROW_CLASS} pointer-events-none cursor-not-allowed opacity-35`}
                            aria-hidden
                          >
                            <ProductCardNavArrowIcon direction="next" />
                          </span>
                        )}
                      </div>

                      <div className="hero-novelty-meta flex w-full max-w-full shrink-0 flex-col gap-2 px-0 text-center md:max-w-[min(100%,36rem)] md:gap-3 md:px-3 md:text-left">
                        <div className="hero-novelty-meta-row flex w-full flex-col items-stretch gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
                          <p className="hero-name hero-novelty-card-title text-base font-semibold text-white md:text-lg lg:text-xl">
                            {stackCard.title}
                          </p>
                          <button
                            type="button"
                            onClick={openNoveltiesSection}
                            className="hero-button hero-novelty-buy-first inline-flex min-h-10 w-full min-w-0 items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 px-4 py-2 text-xs font-semibold text-white shadow-[0_16px_40px_-12px_rgba(168,85,247,0.55)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black md:w-auto md:min-h-[44px] md:min-w-[160px] md:px-6 md:py-3 md:text-sm"
                          >
                            Купить первым
                          </button>
                        </div>
                      </div>
                      </div>
                    </div>
                  ) : (
                    <div className="hero-right-product flex w-full max-w-none min-w-0 flex-col items-end gap-0 overflow-visible py-3">
                      <div className="mt-16 md:mt-0 flex w-full justify-center">
                      <div
                        className={[
                          "hero-primary-card-shell mx-auto w-full origin-top motion-reduce:scale-100",
                          isTmntHeroCard
                            ? "max-w-[min(100%,32rem)] sm:max-w-[min(100%,36rem)] md:max-w-[min(100%,40rem)] lg:max-w-[min(100%,42rem)] xl:max-w-[min(100%,44rem)]"
                            : "max-w-[min(100%,28rem)] sm:max-w-[min(100%,32rem)] md:max-w-[min(100%,36rem)] lg:max-w-[min(100%,38rem)] xl:max-w-[min(100%,40rem)]",
                        ].join(" ")}
                      >
                        <CardViewer
                          layout="product"
                          activeCard={stackCard}
                          browseCards={heroBrowseNonNovelty}
                          hideNavigation
                          productCenterConstrained={true}
                          onCardClick={(cardId) => router.push(`/card/${cardId}`)}
                        />
                      </div>
                      </div>
                      <HeroCatalogCardFooter
                        card={stackCard}
                        flySourceRef={heroCardFlyRef}
                        size="default"
                      />
                    </div>
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
