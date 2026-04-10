"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StoredCard } from "@/app/api/cards/route";
import type { CategoryTile } from "@/app/lib/categoriesJson";
import { apiUrl } from "@/app/lib/apiUrl";
import { ultraOrHeroBgUrl } from "@/app/lib/cardUltraBg";
import { collectionSectionId } from "@/app/lib/collectionAnchor";
import { categoryFocusToStyle } from "@/app/lib/imageFocus";
import type { SpotlightSlideRow } from "@/app/lib/spotlightJson";
import { DEFAULT_SPOTLIGHT_SLIDES } from "@/app/lib/spotlightJson";
import { HeroCardCommerce } from "./HeroCardCommerce";
import { HeroCardStack } from "./HeroCardStack";
import { HeroIlluCardsLogo } from "./HeroIlluCardsLogo";
import { PromoSpotlightPanel } from "./PromoSpotlightPanel";

/** Прокрутка к секции каталога + hash. Запасной якорь — `#collection` (блок «Коллекции»). */
function scrollToCollectionSection(anchorId: string) {
  const tryId = (id: string): boolean => {
    const el = document.getElementById(id);
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      window.history.replaceState(null, "", `/#${id}`);
    } catch {
      /* ignore */
    }
    return true;
  };

  const run = () => {
    if (tryId(anchorId)) return;
    tryId("collection");
  };

  run();
  queueMicrotask(run);
  requestAnimationFrame(run);
  setTimeout(run, 0);
  setTimeout(run, 80);
  setTimeout(run, 250);
  setTimeout(run, 500);
}

type Props = {
  cards: StoredCard[];
  /** Категория `cards[0]` с сервера — до ответа `/api/categories` фильтр героя совпадает с SSR. */
  initialHeroCategoryName: string | null;
  /** Слайды витрины «Акции и подборки» (редактируются в /admin/spotlight). */
  initialSpotlightSlides: SpotlightSlideRow[];
  /** Плашки категорий в герое — с сервера, чтобы показывались даже если fetch на клиенте не сработал (Telegram, блокировки). */
  initialCategories?: CategoryTile[];
};

export default function HeroSection({
  cards,
  initialHeroCategoryName,
  initialSpotlightSlides,
  initialCategories = [],
}: Props) {
  const router = useRouter();
  const heroCardFlyRef = useRef<HTMLDivElement>(null);
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

  const noveltiesCards = useMemo(
    () => cards.filter((c) => c.isNew),
    [cards]
  );

  const [spotlightSlide, setSpotlightSlide] = useState(0);
  const [noveltyIndex, setNoveltyIndex] = useState(0);

  const noveltiesSlideIndex = useMemo(
    () => spotlightSlides.findIndex((s) => s.kind === "novelties"),
    [spotlightSlides]
  );

  useEffect(() => {
    setSpotlightSlide((i) =>
      Math.min(i, Math.max(0, spotlightSlides.length - 1))
    );
  }, [spotlightSlides.length]);

  useEffect(() => {
    setNoveltyIndex((i) => {
      if (noveltiesCards.length === 0) return 0;
      return Math.min(i, noveltiesCards.length - 1);
    });
  }, [noveltiesCards.length]);

  const focusCard = useMemo((): StoredCard | null => {
    if (!displayCard) return null;
    // Плашка категории выбрана явно — в герое показываем эту категорию, а не новинку со слайда «Новинки»
    if (userSelectedCategory != null) {
      return displayCard;
    }
    const isNovelties =
      noveltiesSlideIndex >= 0 && spotlightSlide === noveltiesSlideIndex;
    if (isNovelties && noveltiesCards.length > 0) {
      return noveltiesCards[noveltyIndex % noveltiesCards.length]!;
    }
    return displayCard;
  }, [
    displayCard,
    userSelectedCategory,
    noveltiesSlideIndex,
    spotlightSlide,
    noveltiesCards,
    noveltyIndex,
  ]);

  const noCardsInCategory =
    selectedCategoryName != null &&
    filteredCards.length === 0 &&
    cards.length > 0;

  if (cards.length === 0) {
    return (
      <div className="relative mb-12 flex min-h-[600px] flex-col items-center justify-center px-6 py-16">
        <p className="relative z-10 text-lg text-zinc-400">
          Пока нет карточек в каталоге.
        </p>
      </div>
    );
  }

  if (!displayCard || !focusCard) {
    return null;
  }

  const ultraBgUrl = ultraOrHeroBgUrl(focusCard);
  const isNoveltiesSlide =
    noveltiesSlideIndex >= 0 && spotlightSlide === noveltiesSlideIndex;
  const showNoveltyFlip =
    isNoveltiesSlide && noveltiesCards.length > 1;

  return (
    <div className="relative z-0 mb-12 min-h-[min(600px,92vh)] w-full overflow-visible py-6 sm:py-8">
      {/* Как на макете: та же сетка, что у хедера — max-w-[1400px] + px-6 lg:px-10 */}
      <div className="relative z-0 mx-auto min-h-0 w-full max-w-[1400px] overflow-visible">
        <section
          className="relative z-20 overflow-visible rounded-2xl bg-transparent"
          aria-label="Витрина: логотип IlluCards, категории, подборки и карточка"
        >
          <div className="flex flex-col gap-2 p-6 sm:gap-3 sm:p-8 lg:gap-4 lg:p-10">
            {/* Верх: до xl — колонка (логотип не наезжает на плашки); с xl — ряд */}
            <div className="relative z-30 flex w-full min-w-0 flex-col gap-5 sm:gap-6 xl:flex-row xl:items-start xl:justify-between xl:gap-6">
              <div className="min-w-0 w-full shrink-0 pt-0.5 xl:w-auto xl:max-w-[min(100%,420px)] 2xl:max-w-none">
                <HeroIlluCardsLogo />
              </div>
              <div className="relative -mx-0.5 flex min-h-[80px] min-w-0 w-full flex-1 justify-start gap-3 overflow-x-auto overflow-y-visible px-0.5 pt-0.5 scrollbar-hide sm:gap-4 xl:min-w-0 xl:justify-end">
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
                      scrollToCollectionSection(
                        collectionSectionId(cat.name)
                      );
                    }}
                    aria-label={cat.name}
                    aria-current={selected}
                    className={[
                      "group relative h-[80px] w-[80px] shrink-0 cursor-pointer overflow-hidden rounded-xl bg-zinc-950",
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
                      <div className="absolute inset-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={plateSrc}
                          alt=""
                          className="category-tile-img h-full w-full rounded-[inherit] object-contain"
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

                    <div className="pointer-events-none absolute bottom-1 left-1 right-1 z-10 text-center text-[10px] font-semibold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95),0_0_8px_rgba(0,0,0,0.65)]">
                      {cat.name}
                    </div>
                  </button>
                );
              })}
              </div>
            </div>

            {noCardsInCategory ? (
              <p className="text-center text-sm text-amber-400/90">
                В категории «{selectedCategoryName}» пока нет карточек — показана
                первая доступная.
              </p>
            ) : null}

            <div className="relative z-0 mt-4 flex flex-col items-stretch gap-8 sm:mt-5 lg:mt-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10 xl:gap-14">
              <div
                className={`relative z-10 min-w-0 flex-1 ${
                  isNoveltiesSlide
                    ? "lg:max-w-[min(100%,580px)]"
                    : "lg:max-w-[min(100%,520px)]"
                }`}
              >
                <PromoSpotlightPanel
                  embedded
                  slides={spotlightSlides}
                  slideIndex={spotlightSlide}
                  onSlideChange={setSpotlightSlide}
                  noveltyIndex={noveltyIndex}
                  noveltyTotal={noveltiesCards.length}
                  noveltiesFooter={
                    isNoveltiesSlide ? (
                      <HeroCardCommerce
                        variant="noveltiesBlock"
                        card={focusCard}
                        flySourceRef={heroCardFlyRef}
                        onOpenCard={() => router.push(`/card/${focusCard.id}`)}
                      />
                    ) : undefined
                  }
                />
              </div>

              <div
                className={`relative z-0 w-full min-w-0 lg:shrink-0 ${
                  isNoveltiesSlide
                    ? "lg:max-w-[min(100%,min(720px,92vw))] lg:flex-1 lg:-translate-x-16 xl:-translate-x-20 2xl:-translate-x-24"
                    : "lg:max-w-[min(100%,min(920px,96vw))] lg:-translate-x-24 lg:-translate-y-2 xl:-translate-x-32 xl:-translate-y-3 2xl:-translate-x-40"
                }`}
              >
                <div
                  className={`relative z-10 flex w-full min-w-0 flex-col gap-6 lg:flex-row lg:items-center lg:justify-end xl:gap-10 ${
                    isNoveltiesSlide ? "lg:gap-6" : "lg:gap-8"
                  }`}
                >
                  {!isNoveltiesSlide ? (
                    <HeroCardCommerce
                      card={focusCard}
                      flySourceRef={heroCardFlyRef}
                      onOpenCard={() => router.push(`/card/${focusCard.id}`)}
                    />
                  ) : null}
                  <div className="relative w-full min-w-0 flex-1 lg:max-w-[min(100%,420px)]">
                    {showNoveltyFlip ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setNoveltyIndex(
                              (i) =>
                                (i - 1 + noveltiesCards.length) %
                                noveltiesCards.length
                            )
                          }
                          className="absolute left-0 top-1/2 z-50 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/85 text-white shadow-lg backdrop-blur-sm transition hover:border-zinc-500/50 hover:bg-zinc-900 sm:-left-1 md:left-0"
                          aria-label="Предыдущая новинка"
                        >
                          <ChevronLeft className="h-6 w-6" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setNoveltyIndex(
                              (i) => (i + 1) % noveltiesCards.length
                            )
                          }
                          className="absolute right-0 top-1/2 z-50 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/85 text-white shadow-lg backdrop-blur-sm transition hover:border-zinc-500/50 hover:bg-zinc-900 sm:-right-1 md:right-0"
                          aria-label="Следующая новинка"
                        >
                          <ChevronRight className="h-6 w-6" aria-hidden />
                        </button>
                      </>
                    ) : null}
                    <div
                      ref={heroCardFlyRef}
                      className="grid min-h-[min(400px,68vh)] w-full min-w-0 place-items-center px-6 pb-2 pt-3 sm:px-10 sm:pb-3 sm:pt-4 md:min-h-[min(520px,74vh)] lg:px-4"
                    >
                      <HeroCardStack
                        displayCard={focusCard}
                        ultraBgUrl={ultraBgUrl}
                      />
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
