"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type SetStateAction,
} from "react";
import type { StoredCard } from "@/app/api/cards/route";
import type { CategoryTile } from "@/app/lib/categoriesJson";
import type { PromoHomeConfig, PromoSlide } from "@/app/lib/promoSlidesJson";
import PromoSlider from "@/components/PromoSlider";
import { apiUrl } from "@/app/lib/apiUrl";
import { IMAGE_W, sizedImageSrc } from "@/app/lib/sizedImage";
import { saveCurrentScrollPosition } from "@/app/lib/catalogScrollRestore";
import { stashProductCard } from "@/app/lib/productCardPreview";
import { restorePageScrollAfterLayoutChange } from "@/app/lib/preservePageScroll";
import { buildNoveltiesCarouselCards } from "@/app/lib/noveltiesHeroCarousel";
import { sortSectionCardsForDefaultCatalog } from "@/app/lib/collectionFilter";
import {
  CardViewer,
  ProductCardNavArrowIcon,
} from "@/app/components/card-showcase/CardViewer";
import { HeroCatalogCardFooter } from "./HeroCatalogCardFooter";
import { HeroIlluCardsLogo } from "./HeroIlluCardsLogo";

/** Горизонтальный жест мышью по стопке «Новинки» (на таче только стрелки — см. обработчики). */
const NOVELTY_SWIPE_MIN_PX = 56;

type Props = {
  cards: StoredCard[];
  /** Категория `cards[0]` с сервера — до ответа `/api/categories` фильтр героя совпадает с SSR. */
  initialHeroCategoryName: string | null;
  /** Плашки категорий в герое — с сервера, чтобы показывались даже если fetch на клиенте не сработал (Telegram, блокировки). */
  initialCategories?: CategoryTile[];
  /** Ужать герой по вертикали (главная «в один экран»). */
  viewportCompact?: boolean;
  /** Плашки «на заказ» и акции — с сервера для SSR без «мигания». */
  initialPromoSlides?: PromoSlide[];
  initialPromoConfig?: PromoHomeConfig;
};

export default function HeroSection({
  cards,
  initialHeroCategoryName,
  initialCategories = [],
  viewportCompact = false,
  initialPromoSlides = [],
  initialPromoConfig,
}: Props) {
  const router = useRouter();
  const openCardPage = useCallback(
    (cardId: string) => {
      const id = String(cardId || "").trim();
      if (!id) return;
      stashProductCard(cards.find((c) => c.id === id));
      saveCurrentScrollPosition();
      router.push(`/card/${id}`);
    },
    [cards, router],
  );
  const heroCardFlyRef = useRef<HTMLDivElement>(null);
  const noveltyDragStartRef = useRef<{ x: number; y: number } | null>(null);
  /** Сохраняем scrollY страницы при смене карточки в «Новинках». */
  const preservePageScrollRef = useRef<number | null>(null);
  const preHeroHeightRef = useRef(0);
  /** После свайпа гасим синтетический click по `<Link>` на карточке. */
  const blockHeroCardLinkClickRef = useRef(false);
  const [apiCategories, setApiCategories] = useState<CategoryTile[]>(
    () => initialCategories
  );
  useEffect(() => {
    if (initialCategories.length > 0) return;
    fetch(apiUrl("/api/categories"))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setApiCategories(data as CategoryTile[]);
        }
      })
      .catch(() => {});
  }, [initialCategories.length]);

  const autoCategoryName = useMemo(() => {
    if (!apiCategories.length || !cards.length) return null;
    const match = apiCategories.find((cat) =>
      cards.some((c) => (c.category?.trim() ?? "") === cat.name.trim())
    );
    return match?.name ?? apiCategories[0].name;
  }, [apiCategories, cards]);

  const selectedCategoryName =
    autoCategoryName ?? initialHeroCategoryName;

  const filteredCards = useMemo(() => {
    if (!selectedCategoryName) return cards;
    const n = selectedCategoryName.trim();
    return cards.filter((c) => (c.category?.trim() ?? "") === n);
  }, [cards, selectedCategoryName]);

  const displayCard = filteredCards[0] ?? cards[0] ?? null;

  /** Карточки выбранной категории в порядке витрины. */
  const heroBrowseCards = useMemo(() => {
    const base = filteredCards.length > 0 ? filteredCards : cards;
    return sortSectionCardsForDefaultCatalog(base, cards);
  }, [filteredCards, cards]);

  /** Все активные новинки из каталога (не зависят от выбранной категории в герое). */
  const allNoveltiesCards = useMemo(
    () => buildNoveltiesCarouselCards(cards),
    [cards],
  );

  const showNoveltiesHeroChrome = allNoveltiesCards.length > 0;

  const activeBrowseCards = showNoveltiesHeroChrome
    ? allNoveltiesCards
    : heroBrowseCards;

  const [browseIndex, setBrowseIndexState] = useState(0);

  const setBrowseIndex = useCallback(
    (value: SetStateAction<number>) => {
      if (showNoveltiesHeroChrome && typeof window !== "undefined") {
        preservePageScrollRef.current = window.scrollY;
        const hero = document.querySelector(".hero");
        preHeroHeightRef.current =
          hero?.getBoundingClientRect().height ?? preHeroHeightRef.current;
      }
      setBrowseIndexState(value);
    },
    [showNoveltiesHeroChrome],
  );

  useLayoutEffect(() => {
    if (!showNoveltiesHeroChrome) return;
    const y = preservePageScrollRef.current;
    if (y == null) return;
    preservePageScrollRef.current = null;
    if (y < 96) return;

    const hero = document.querySelector(".hero");
    const newH = hero?.getBoundingClientRect().height ?? preHeroHeightRef.current;
    const delta = newH - preHeroHeightRef.current;
    preHeroHeightRef.current = newH;

    restorePageScrollAfterLayoutChange(y, delta);
  }, [browseIndex, showNoveltiesHeroChrome]);

  const browseCarouselKey = useMemo(
    () => activeBrowseCards.map((c) => c.id).join(","),
    [activeBrowseCards],
  );

  const onHeroBrowseNavigate = useCallback(
    (nextId: string) => {
      const j = activeBrowseCards.findIndex((c) => c.id === nextId);
      if (j >= 0) setBrowseIndex(j);
    },
    [activeBrowseCards],
  );

  useEffect(() => {
    setBrowseIndex(0);
  }, [browseCarouselKey]);

  useEffect(() => {
    setBrowseIndex((i) => {
      if (activeBrowseCards.length === 0) return 0;
      return Math.min(i, activeBrowseCards.length - 1);
    });
  }, [activeBrowseCards.length]);

  const focusCard = useMemo((): StoredCard | null => {
    if (!displayCard) return null;
    if (activeBrowseCards.length > 0) {
      return activeBrowseCards[browseIndex % activeBrowseCards.length]!;
    }
    return displayCard;
  }, [displayCard, activeBrowseCards, browseIndex]);

  /** Герой без «пустой» карточки: первый кандидат с непустым лицом. */
  const heroShowcaseCard = useMemo((): StoredCard | null => {
    const ok = (c: StoredCard | null | undefined) =>
      c && c.frontImage?.trim() ? c : null;
    return (
      ok(focusCard) ??
      ok(displayCard) ??
      activeBrowseCards.find((c) => ok(c)) ??
      filteredCards.find((c) => ok(c)) ??
      cards.find((c) => ok(c)) ??
      null
    );
  }, [focusCard, displayCard, activeBrowseCards, filteredCards, cards]);

  useEffect(() => {
    const id = (heroShowcaseCard ?? focusCard)?.id?.trim();
    if (!id) return;
    router.prefetch(`/card/${id}`);
  }, [heroShowcaseCard, focusCard, router]);

  const noCardsInCategory =
    selectedCategoryName != null &&
    filteredCards.length === 0 &&
    cards.length > 0;

  const canCycleWithArrows = activeBrowseCards.length > 1;

  const stepBrowseIndex = useCallback(
    (delta: number) => {
      if (activeBrowseCards.length < 2) return;
      setBrowseIndex((i) => {
        const n = activeBrowseCards.length;
        return (i + delta + n * 16) % n;
      });
    },
    [activeBrowseCards.length],
  );

  const onNoveltyArrowKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (activeBrowseCards.length < 2) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepBrowseIndex(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        stepBrowseIndex(1);
      }
    },
    [activeBrowseCards.length, stepBrowseIndex]
  );

  const applyNoveltySwipeFromDelta = useCallback(
    (start: { x: number; y: number }, endX: number, endY: number) => {
      if (activeBrowseCards.length < 2) {
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
      window.setTimeout(() => {
        blockHeroCardLinkClickRef.current = false;
      }, 450);
      if (dx < 0) {
        setBrowseIndex((i) => (i + 1) % activeBrowseCards.length);
      } else {
        setBrowseIndex(
          (i) => (i - 1 + activeBrowseCards.length) % activeBrowseCards.length
        );
      }
    },
    [activeBrowseCards.length]
  );

  const onNoveltyPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      if (e.button !== 0) return;
      if (activeBrowseCards.length < 2) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target?.closest?.(
          "[data-novelty-hero-chrome], [data-hero-novelty-flank-nav], [data-adult-age-gate]"
        )
      )
        return;
      noveltyDragStartRef.current = { x: e.clientX, y: e.clientY };
      /* Не захватываем указатель на pointerdown: иначе первый клик не доходит до ссылки карточки. */
    },
    [activeBrowseCards.length]
  );

  const onNoveltyPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const start = noveltyDragStartRef.current;
      if (!start || activeBrowseCards.length < 2) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (
        Math.abs(dx) < NOVELTY_SWIPE_MIN_PX ||
        Math.abs(dx) < Math.abs(dy)
      ) {
        return;
      }
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    },
    [activeBrowseCards.length]
  );

  const onNoveltyPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const start = noveltyDragStartRef.current;
      noveltyDragStartRef.current = null;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
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
  const isBerserkHeroCard = stackCategoryLower === "берсерк";

  return (
    <div
      className={`relative z-0 w-full overflow-visible pt-0 ${
        viewportCompact
          ? "hero-viewport-compact mb-0 flex min-h-0 min-w-0 flex-1 flex-col pb-0"
          : "mb-0 pb-0"
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
            {/* Десктоп: логотип в левой колонке (flex-стек). ≤1024 — см. globals (display: contents). */}
            <div className="hero-body min-w-0 w-full">
              <div
                className={`hero-main-desktop hero-product-layout min-w-0 w-full ${
                  viewportCompact ? "min-h-0 flex-1" : ""
                }`}
              >
                <div className="hero-left-side min-w-0">
                  <div className="hero-wordmark-row hidden min-w-0 w-full shrink-0 md:block">
                    <HeroIlluCardsLogo />
                  </div>

                  <div className="hero-promo-desktop-slot min-w-0">
                    <PromoSlider
                      cards={cards}
                      initialConfig={initialPromoConfig}
                      initialSlides={initialPromoSlides}
                    />
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
                    "hero-right-side--product",
                    isMarvelHeroCard ? "hero-right-side--marvel" : "",
                    isTmntHeroCard ? "hero-right-side--tmnt" : "",
                    isBerserkHeroCard ? "hero-right-side--berserk" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div
                    className={[
                      "hero-cell-card hero-card relative z-20 flex w-full min-w-0 max-w-full flex-col justify-start",
                      viewportCompact ? "min-h-0" : "",
                      showNoveltiesHeroChrome ? "items-start" : "items-center",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                  {showNoveltiesHeroChrome ? (
                    <div className="hero-product-section">
                      <div className="hero-product-stage">
                        <div className="hero-title hero-novelty-header w-full shrink-0 text-center">
                          <div className="hero-novelty-header-inner mx-auto flex w-full max-w-full flex-col items-center gap-1">
                            <h2 className="hero-novelties-title hero-wordmark-shine hero-wordmark-shine--mirror hero-scale-wordmark relative m-0 mx-auto block w-full max-w-full origin-center text-balance text-center font-bold tracking-tight drop-shadow-[0_2px_0_rgba(0,0,0,0.55),0_10px_36px_rgba(109,40,217,0.45),0_22px_48px_rgba(0,0,0,0.45)]">
                              Новинки
                            </h2>
                            {activeBrowseCards.length > 1 ? (
                              <p
                                className="hero-novelties-counter relative z-[2] text-xs font-medium tabular-nums text-violet-200 sm:text-sm"
                                aria-live="polite"
                              >
                                {(browseIndex % activeBrowseCards.length) + 1} из{" "}
                                {activeBrowseCards.length}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div
                          ref={heroCardFlyRef}
                          onPointerDown={onNoveltyPointerDown}
                          onPointerMove={onNoveltyPointerMove}
                          onPointerUp={onNoveltyPointerUp}
                          onPointerCancel={onNoveltyPointerCancel}
                          onClickCapture={(e) => {
                            if (!blockHeroCardLinkClickRef.current) return;
                            e.preventDefault();
                            e.stopPropagation();
                            blockHeroCardLinkClickRef.current = false;
                          }}
                          className="hero-cards-stack"
                        >
                          {canCycleWithArrows ? (
                            <button
                              type="button"
                              data-hero-novelty-flank-nav
                              aria-label="Предыдущая карточка"
                              onClick={(e) => {
                                e.stopPropagation();
                                stepBrowseIndex(-1);
                              }}
                              onKeyDown={onNoveltyArrowKeyDown}
                              className="arrow arrow--left hero-novelty-side-arrow hero-novelty-arrow--prev hero-novelty-nav-btn"
                            >
                              <ProductCardNavArrowIcon direction="prev" />
                            </button>
                          ) : (
                            <span
                              data-hero-novelty-flank-nav
                              className="arrow arrow--left hero-novelty-side-arrow hero-novelty-arrow--prev hero-novelty-nav-btn pointer-events-none cursor-not-allowed opacity-35"
                              aria-hidden
                            >
                              <ProductCardNavArrowIcon direction="prev" />
                            </span>
                          )}

                          <div className="hero-cards-main">
                            <CardViewer
                              layout="product"
                              activeCard={stackCard}
                              browseCards={activeBrowseCards}
                              onNavigate={onHeroBrowseNavigate}
                              hideNavigation
                              productCenterConstrained={true}
                              onCardClick={openCardPage}
                            />
                          </div>

                          {canCycleWithArrows ? (
                            <button
                              type="button"
                              data-hero-novelty-flank-nav
                              aria-label="Следующая карточка"
                              onClick={(e) => {
                                e.stopPropagation();
                                stepBrowseIndex(1);
                              }}
                              onKeyDown={onNoveltyArrowKeyDown}
                              className="arrow arrow--right hero-novelty-side-arrow hero-novelty-arrow--next hero-novelty-nav-btn"
                            >
                              <ProductCardNavArrowIcon direction="next" />
                            </button>
                          ) : (
                            <span
                              data-hero-novelty-flank-nav
                              className="arrow arrow--right hero-novelty-side-arrow hero-novelty-arrow--next hero-novelty-nav-btn pointer-events-none cursor-not-allowed opacity-35"
                              aria-hidden
                            >
                              <ProductCardNavArrowIcon direction="next" />
                            </span>
                          )}
                        </div>

                        {activeBrowseCards.length > 1 ? (
                          <div className="hero-novelties-thumb-strip-wrap w-full max-w-full shrink-0 px-0 md:px-1">
                            <div
                              className="hero-novelties-thumb-strip scrollbar-hide flex w-full gap-2 overflow-x-auto overflow-y-hidden py-1"
                              role="tablist"
                              aria-label="Все новинки"
                            >
                              {activeBrowseCards.map((c, i) => {
                                const active =
                                  i === browseIndex % activeBrowseCards.length;
                                const thumb = c.frontImage?.trim();
                                if (!thumb) return null;
                                return (
                                  <button
                                    key={c.id}
                                    type="button"
                                    role="tab"
                                    data-novelty-thumb={c.id}
                                    aria-selected={active}
                                    aria-label={c.title}
                                    onClick={() => setBrowseIndex(i)}
                                    className={[
                                      "hero-novelties-thumb shrink-0 overflow-hidden rounded-lg border-2 bg-zinc-900 transition",
                                      active
                                        ? "border-violet-400 shadow-[0_0_16px_rgba(168,85,247,0.45)]"
                                        : "border-white/10 opacity-75 hover:border-violet-300/50 hover:opacity-100",
                                    ].join(" ")}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={sizedImageSrc(thumb, IMAGE_W.thumb)}
                                      alt=""
                                      className="block h-12 w-9 object-cover object-center sm:h-14 sm:w-10"
                                      draggable={false}
                                      loading={i < 2 ? "eager" : "lazy"}
                                      fetchPriority={i === 0 ? "high" : "low"}
                                      decoding="async"
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}

                        <div className="hero-product-info">
                          <HeroCatalogCardFooter
                            card={stackCard}
                            flySourceRef={heroCardFlyRef}
                            size="novelty"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="hero-product-section">
                      <div className="hero-product-stage">
                        <div className="hero-cards-stack" ref={heroCardFlyRef}>
                          {canCycleWithArrows ? (
                            <button
                              type="button"
                              aria-label="Предыдущая карточка"
                              onClick={(e) => {
                                e.stopPropagation();
                                stepBrowseIndex(-1);
                              }}
                              className="hero-novelty-side-arrow hero-novelty-arrow--prev hero-novelty-nav-btn"
                            >
                              <ProductCardNavArrowIcon direction="prev" />
                            </button>
                          ) : null}
                          <div className="hero-cards-main">
                            <CardViewer
                              layout="product"
                              activeCard={stackCard}
                              browseCards={activeBrowseCards}
                              onNavigate={onHeroBrowseNavigate}
                              hideNavigation
                              productCenterConstrained={true}
                              onCardClick={openCardPage}
                            />
                          </div>
                          {canCycleWithArrows ? (
                            <button
                              type="button"
                              aria-label="Следующая карточка"
                              onClick={(e) => {
                                e.stopPropagation();
                                stepBrowseIndex(1);
                              }}
                              className="hero-novelty-side-arrow hero-novelty-arrow--next hero-novelty-nav-btn"
                            >
                              <ProductCardNavArrowIcon direction="next" />
                            </button>
                          ) : null}
                        </div>
                        <div className="hero-product-info">
                          <HeroCatalogCardFooter
                            card={stackCard}
                            flySourceRef={heroCardFlyRef}
                            size="default"
                          />
                        </div>
                      </div>
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
