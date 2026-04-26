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
import type { PromoSlide } from "@/app/lib/promoSlidesJson";
import PromoSlider from "@/components/PromoSlider";
import { apiUrl } from "@/app/lib/apiUrl";
import { collectionSectionId } from "@/app/lib/collectionAnchor";
import { categoryFocusToStyle } from "@/app/lib/imageFocus";
import { buildNoveltiesCarouselCards } from "@/app/lib/noveltiesHeroCarousel";
import {
  CardViewer,
  PRODUCT_CARD_NAV_ARROW_CLASS,
  ProductCardNavArrowIcon,
} from "@/app/components/card-showcase/CardViewer";
import { HeroCatalogCardFooter } from "./HeroCatalogCardFooter";
import { HeroIlluCardsLogo } from "./HeroIlluCardsLogo";

/** Горизонтальный жест мышью по стопке «Новинки» (на таче только стрелки — см. обработчики). */
const NOVELTY_SWIPE_MIN_PX = 56;

/** Автосмена карточки в блоке «Новинки» (стрелки и ручной свайп по-прежнему доступны). */
const NOVELTY_AUTO_ADVANCE_MS = 5500;

type Props = {
  cards: StoredCard[];
  /** Категория `cards[0]` с сервера — до ответа `/api/categories` фильтр героя совпадает с SSR. */
  initialHeroCategoryName: string | null;
  /** Плашки категорий в герое — с сервера, чтобы показывались даже если fetch на клиенте не сработал (Telegram, блокировки). */
  initialCategories?: CategoryTile[];
  /** Ужать герой по вертикали (главная «в один экран»). */
  viewportCompact?: boolean;
  /** Акции под категориями — с сервера для SSR без «мигания». */
  initialPromoSlides?: PromoSlide[];
};

export default function HeroSection({
  cards,
  initialHeroCategoryName,
  initialCategories = [],
  viewportCompact = false,
  initialPromoSlides = [],
}: Props) {
  const router = useRouter();
  const heroCardFlyRef = useRef<HTMLDivElement>(null);
  const noveltyDragStartRef = useRef<{ x: number; y: number } | null>(null);
  /** После свайпа гасим синтетический click по `<Link>` на карточке. */
  const blockHeroCardLinkClickRef = useRef(false);
  /** Пауза автолистания при наведении на колонку «Новинки». */
  const noveltyAutoPausedRef = useRef(false);
  const noveltiesLenRef = useRef(0);
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

  const [noveltyIndex, setNoveltyIndex] = useState(0);

  const noveltiesCards = useMemo(
    () => buildNoveltiesCarouselCards(cards),
    [cards]
  );

  const noveltiesCarouselKey = useMemo(
    () => noveltiesCards.map((c) => c.id).join(","),
    [noveltiesCards]
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
    if (noveltiesCards.length < 2) return;
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
  }, [noveltiesCards.length]);

  useEffect(() => {
    setNoveltyIndex(0);
  }, [noveltiesCarouselKey]);

  useEffect(() => {
    setNoveltyIndex((i) => {
      if (noveltiesCards.length === 0) return 0;
      return Math.min(i, noveltiesCards.length - 1);
    });
  }, [noveltiesCards.length]);

  const focusCard = useMemo((): StoredCard | null => {
    if (!displayCard) return null;
    /** Справа карусель новинок (категория «Новинки» или флаги новинки), пока есть что показывать. */
    if (noveltiesCards.length > 0) {
      return noveltiesCards[noveltyIndex % noveltiesCards.length]!;
    }
    return displayCard;
  }, [displayCard, noveltiesCards, noveltyIndex]);

  /** Герой без «пустой» карточки: первый кандидат с непустым лицом. */
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

  const showNoveltiesHeroChrome = noveltiesCards.length > 0;

  const canCycleNoveltiesWithArrows = noveltiesCards.length > 1;

  const stepNoveltyIndex = useCallback(
    (delta: number) => {
      if (noveltiesCards.length < 2) return;
      setNoveltyIndex((i) => {
        const n = noveltiesCards.length;
        return (i + delta + n * 16) % n;
      });
    },
    [noveltiesCards.length]
  );

  const onNoveltyAutoPauseEnter = useCallback(() => {
    noveltyAutoPausedRef.current = true;
  }, []);

  const onNoveltyAutoPauseLeave = useCallback(() => {
    noveltyAutoPausedRef.current = false;
  }, []);

  const onNoveltyArrowKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (noveltiesCards.length < 2) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepNoveltyIndex(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        stepNoveltyIndex(1);
      }
    },
    [noveltiesCards.length, stepNoveltyIndex]
  );

  const applyNoveltySwipeFromDelta = useCallback(
    (start: { x: number; y: number }, endX: number, endY: number) => {
      if (noveltiesCards.length < 2) {
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
    [noveltiesCards.length]
  );

  const onNoveltyPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      if (e.button !== 0) return;
      if (noveltiesCards.length < 2) {
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
    [noveltiesCards.length]
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
          aria-label="Герой: логотип IlluCards, категории и карточка"
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

            {/* 2–3. Десктоп: слева категории, справа карточка. ≤768 — см. globals. */}
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
                      "category-item group shrink-0 cursor-pointer overflow-hidden rounded-2xl bg-zinc-950",
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

                  <div className="hero-promo-desktop-slot hidden min-w-0 md:block">
                    <PromoSlider initialSlides={initialPromoSlides} />
                  </div>

                  {noCardsInCategory ? (
                    <p className="hero-category-empty-msg text-center text-sm text-amber-400/90">
                      В категории «{selectedCategoryName}» пока нет карточек —
                      показана первая доступная.
                    </p>
                  ) : null}
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
                    <div className="hero-right-product flex w-full max-w-none min-w-0 flex-col items-center gap-0 overflow-visible py-0 md:items-stretch md:gap-0 md:py-0">
                      <div className="hero-novelties-mobile-stack flex w-full max-w-full flex-col items-stretch gap-10 max-md:w-full max-md:px-0 md:contents md:max-w-none">
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
                        className={`hero-slider hero-novelty-card-shell relative flex w-full max-w-full shrink-0 items-start justify-center gap-2 px-0 md:gap-3 md:px-2 ${
                          isTmntHeroCard
                            ? "md:max-w-[min(100%,52rem)]"
                            : isMarvelHeroCard
                              ? "md:max-w-[min(100%,58rem)]"
                              : "md:max-w-[min(100%,47rem)]"
                        }`}
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

                      <div
                        className={`hero-novelty-meta flex w-full max-w-full shrink-0 flex-col gap-2 px-0 text-left max-md:mt-6 md:gap-3 md:px-3 ${
                          isTmntHeroCard
                            ? "md:max-w-[min(100%,50rem)]"
                            : isMarvelHeroCard
                              ? "md:max-w-[min(100%,50rem)]"
                              : "md:max-w-[min(100%,42rem)]"
                        }`}
                      >
                        <div className="hero-novelty-meta-row w-full">
                          <p className="hero-name hero-novelty-card-title line-clamp-2 max-w-full text-balance text-base font-semibold text-white md:text-lg lg:text-xl">
                            {stackCard.title}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/card/${stackCard.id}`);
                            }}
                            className="hero-button hero-novelty-buy-first inline-flex min-h-10 w-auto min-w-0 max-w-full shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 px-4 py-2 text-xs font-semibold text-white shadow-[0_16px_40px_-12px_rgba(168,85,247,0.55)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black md:min-h-[44px] md:min-w-[160px] md:px-6 md:py-3 md:text-sm"
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
                            ? "max-w-[min(100%,36rem)] sm:max-w-[min(100%,40rem)] md:max-w-[min(100%,46rem)] lg:max-w-[min(100%,50rem)] xl:max-w-[min(100%,54rem)]"
                            : "max-w-[min(100%,30rem)] sm:max-w-[min(100%,34rem)] md:max-w-[min(100%,38rem)] lg:max-w-[min(100%,40rem)] xl:max-w-[min(100%,42rem)]",
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

              <div
                className="hero-mobile-akcii mt-4 w-full min-w-0 shrink-0 md:hidden"
                aria-label="Акции"
              >
                <h2 className="hero-akcii-mobile-title mb-2.5 text-center text-[0.7rem] font-bold uppercase tracking-[0.14em] text-white/90">
                  Акции
                </h2>
                <PromoSlider initialSlides={initialPromoSlides} />
              </div>
            </div>
            </div>
            </div>
        </section>
      </div>
    </div>
  );
}
