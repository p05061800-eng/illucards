"use client";

import {
  ChevronDown,
  Copy,
  Flame,
  Gem,
  Layers2,
  RotateCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { StoredCard } from "../api/cards/route";
import type { CategoryTile } from "../lib/categoriesJson";
import { useCatalogFilter } from "../context/CatalogFilterContext";
import {
  filterCollectionCards,
  sortCardsByPrice,
  sortSectionCardsForDefaultCatalog,
  type TypeFilterState,
} from "../lib/collectionFilter";
import { collectionSectionId } from "../lib/collectionAnchor";
import { categoryFocusToStyle } from "../lib/imageFocus";
import { CardPreview } from "./CardPreview";

type Props = {
  cards: StoredCard[];
  categories: CategoryTile[];
  /** Компактный каталог под главную «в один экран». */
  viewportCompact?: boolean;
};

const filterLabelClass =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/75";

/**
 * Число карточек в свёрнутой строке «Смотреть ещё» — по фактической ширине списка
 * (ResizeObserver), в духе плавной сетки `.collection-card-grid`, без скачков по innerWidth.
 */
function useCollectionPreviewColumns(
  widthRef: RefObject<HTMLDivElement | null>,
  viewportCompact: boolean
): number {
  const [cols, setCols] = useState(3);

  useLayoutEffect(() => {
    const el = widthRef.current;
    if (!el || typeof window === "undefined") return;

    const compute = () => {
      const w = el.getBoundingClientRect().width;
      const gapPx = 14;
      const compactLg =
        viewportCompact && window.matchMedia("(min-width: 1024px)").matches;
      if (compactLg) {
        setCols((c) => (c !== 3 ? 3 : c));
        return;
      }
      const desktopFive =
        !viewportCompact && window.matchMedia("(min-width: 1280px)").matches;
      if (desktopFive) {
        setCols((c) => (c !== 5 ? 5 : c));
        return;
      }
      const minCell = viewportCompact ? 128 : 156;
      const approx = Math.max(
        2,
        Math.min(6, Math.floor((w + gapPx) / (minCell + gapPx)))
      );
      setCols((c) => (c !== approx ? approx : c));
    };

    compute();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(compute);
    });
    ro.observe(el);

    const mqWide = window.matchMedia("(min-width: 1280px)");
    const mqCompactLg = window.matchMedia("(min-width: 1024px)");
    const onMq = () => compute();
    mqWide.addEventListener("change", onMq);
    mqCompactLg.addEventListener("change", onMq);

    return () => {
      ro.disconnect();
      mqWide.removeEventListener("change", onMq);
      mqCompactLg.removeEventListener("change", onMq);
    };
  }, [widthRef, viewportCompact]);

  return cols;
}

/** Автопереход на страницу карточки: точное совпадение названия или ровно одна карточка по подстроке в title. */
const SEARCH_NAV_DEBOUNCE_MS = 380;

/** Баннер строки категории: высота от файла, без aspect-ratio на контейнере. */
function CategoryRowBanner({
  cat,
  sectionId,
  compact,
}: {
  cat: CategoryTile;
  sectionId: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`category-row-banner-card relative w-full rounded-none bg-zinc-950 ${
        compact ? "h-12 overflow-hidden sm:h-14" : ""
      }`}
    >
      {cat.image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cat.image}
            alt=""
            className={`block w-full max-w-full ${
              compact
                ? "h-full min-h-0 object-cover"
                : "h-auto"
            }`}
            style={categoryFocusToStyle(cat.imageFocus)}
            draggable={false}
          />
        </>
      ) : (
        <div
          className={
            compact
              ? "h-full min-h-[3rem] bg-gradient-to-br from-zinc-900 via-zinc-950 to-[#070510]"
              : "min-h-[120px] bg-gradient-to-br from-zinc-900 via-zinc-950 to-[#070510]"
          }
          aria-hidden
        />
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/88 via-black/15 to-transparent"
        aria-hidden
      />
      <h2
        id={`${sectionId}-heading`}
        className={`absolute left-0 right-0 max-w-none truncate px-4 font-bold tracking-tight text-white drop-shadow-md sm:px-6 ${
          compact
            ? "bottom-1 text-xs sm:bottom-1.5 sm:text-sm"
            : "bottom-2 text-base sm:bottom-3 sm:px-10 sm:text-lg md:text-xl"
        }`}
      >
        {cat.name}
      </h2>
    </div>
  );
}

export function HomeCollection({
  cards,
  categories,
  viewportCompact = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchInputRef = useRef<HTMLInputElement>(null);
  /** Не запускать автопереход в карточку на первом прогоне эффекта после загрузки/обновления страницы. */
  const skipSearchAutoNavOnceRef = useRef(true);
  const collectionMeasureRef = useRef<HTMLDivElement>(null);
  const previewCols = useCollectionPreviewColumns(
    collectionMeasureRef,
    viewportCompact
  );
  const [expandedCategoryRows, setExpandedCategoryRows] = useState<
    Record<string, boolean>
  >({});

  const setCategoryExpanded = useCallback((name: string, value: boolean) => {
    setExpandedCategoryRows((prev) => ({ ...prev, [name]: value }));
  }, []);

  const {
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    typeFilter,
    toggleType,
    priceSort,
    setPriceSort,
    filtersOpen,
    setFiltersOpen,
    resetFilters,
  } = useCatalogFilter();

  useEffect(() => {
    if (!filtersOpen) return;
    const id = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [filtersOpen]);

  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  useEffect(() => {
    if (pathname !== "/") return;
    if (skipSearchAutoNavOnceRef.current) {
      skipSearchAutoNavOnceRef.current = false;
      return;
    }
    const q = search.trim();
    if (q.length < 2) return;

    const id = window.setTimeout(() => {
      const lower = q.toLowerCase();
      const exact = cards.find(
        (c) => c.title.trim().toLowerCase() === lower
      );
      if (exact) {
        setSearch("");
        router.push(`/card/${exact.id}`);
        return;
      }
      const byTitle = cards.filter((c) =>
        c.title.toLowerCase().includes(lower)
      );
      if (byTitle.length === 1) {
        setSearch("");
        router.push(`/card/${byTitle[0].id}`);
      }
    }, SEARCH_NAV_DEBOUNCE_MS);

    return () => window.clearTimeout(id);
  }, [search, cards, pathname, router, setSearch]);

  const apiOrder = categories
    .map((c) => ({ ...c, name: c.name.trim() }))
    .filter((c) => c.name.length > 0);

  const namesWithCards = new Set(
    cards.map((c) => c.category?.trim()).filter(Boolean) as string[]
  );

  const orphanNames = [...namesWithCards]
    .filter((n) => !apiOrder.some((c) => c.name === n))
    .sort((a, b) => a.localeCompare(b, "ru"));

  const categoryOptions = useMemo(() => {
    const fromApi = apiOrder.map((c) => c.name);
    const merged = [...fromApi];
    for (const o of orphanNames) {
      if (!merged.includes(o)) merged.push(o);
    }
    return merged.sort((a, b) => a.localeCompare(b, "ru"));
  }, [apiOrder, orphanNames]);

  const filteredRaw = useMemo(
    () =>
      filterCollectionCards(cards, {
        search,
        category: categoryFilter,
        typeFilter,
      }),
    [cards, search, categoryFilter, typeFilter]
  );

  const filteredSorted = useMemo(
    () => sortCardsByPrice(filteredRaw, priceSort),
    [filteredRaw, priceSort]
  );

  const sections: CategoryTile[] = useMemo(() => {
    const base = [
      ...apiOrder,
      ...orphanNames.map((name) => ({ name, image: "" })),
    ];
    if (!categoryFilter.trim()) return base;
    return base.filter((s) => s.name === categoryFilter.trim());
  }, [apiOrder, orphanNames, categoryFilter]);

  const hasActiveFilters =
    search.trim() !== "" ||
    categoryFilter.trim() !== "" ||
    typeFilter.adult ||
    typeFilter.limited ||
    typeFilter.common ||
    typeFilter.replica ||
    typeFilter.hotPrice ||
    typeFilter.novelties ||
    priceSort !== "default";

  /** Одна строка превью + «Смотреть ещё» только на главной без фильтров. */
  const useCategoryRowPreview = !hasActiveFilters;

  if (sections.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        В каталоге пока нет карточек.
      </p>
    );
  }

  const typeChips: {
    key: keyof TypeFilterState;
    label: string;
    Icon: typeof Sparkles;
  }[] = [
    { key: "adult", label: "18+", Icon: ShieldAlert },
    { key: "limited", label: "Лимитированные", Icon: Gem },
    { key: "common", label: "Обычные", Icon: Layers2 },
    { key: "replica", label: "Реплики", Icon: Copy },
    { key: "hotPrice", label: "Горячая цена", Icon: Flame },
    { key: "novelties", label: "Новинки", Icon: Sparkles },
  ];

  const outerStack = viewportCompact ? "space-y-3 sm:space-y-4" : "space-y-10 sm:space-y-12";
  const sectionStack = viewportCompact
    ? "space-y-5 sm:space-y-6"
    : "space-y-16 sm:space-y-20";

  return (
    <div className={outerStack}>
      <div className="relative overflow-visible rounded-2xl border border-white/[0.09] bg-gradient-to-br from-violet-950/40 via-zinc-950/90 to-fuchsia-950/25 p-[1px] shadow-[0_0_48px_-8px_rgba(139,92,246,0.4)]">
        <div
          className={`relative overflow-visible rounded-[15px] bg-zinc-950/90 backdrop-blur-md ${
            viewportCompact
              ? filtersOpen
                ? "px-2.5 py-2 sm:px-3 sm:py-2.5"
                : "p-2 sm:p-2.5"
              : filtersOpen
                ? "px-3 py-3 sm:px-4 sm:py-3.5"
                : "p-2.5 sm:p-3"
          }`}
        >
          {filtersOpen ? (
            <>
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-fuchsia-500/12 blur-3xl"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -bottom-12 -left-12 h-28 w-28 rounded-full bg-violet-600/15 blur-3xl"
                aria-hidden
              />
            </>
          ) : null}

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="group relative min-w-0 flex-1">
              <div
                className="pointer-events-none absolute -inset-px rounded-lg bg-gradient-to-r from-violet-500/0 via-fuchsia-500/0 to-violet-500/0 opacity-0 blur-[1px] transition-opacity duration-300 group-focus-within:from-violet-500/35 group-focus-within:via-fuchsia-400/25 group-focus-within:to-violet-500/35 group-focus-within:opacity-100"
                aria-hidden
              />
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-violet-400/80"
                aria-hidden
              />
              <input
                ref={searchInputRef}
                id="collection-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск…"
                autoComplete="off"
                aria-label="Поиск по каталогу"
                className="relative w-full rounded-lg border border-white/10 bg-black/45 py-2 pl-9 pr-3 text-[13px] text-zinc-100 shadow-inner shadow-black/20 placeholder:text-zinc-600 focus:border-violet-400/45 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-pressed={filtersOpen}
              aria-label={
                filtersOpen
                  ? "Свернуть дополнительные фильтры"
                  : "Открыть фильтры"
              }
              title={filtersOpen ? "Свернуть" : "Фильтры"}
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition sm:h-11 sm:w-11 ${
                filtersOpen
                  ? "border-violet-400/50 bg-violet-500/15 text-violet-200"
                  : "border-white/10 bg-black/40 text-zinc-300 hover:border-violet-400/35 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <SlidersHorizontal
                className="h-[18px] w-[18px]"
                aria-hidden
              />
              {hasActiveFilters ? (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-fuchsia-500 shadow-[0_0_8px_rgba(217,70,239,0.8)]" />
              ) : null}
            </button>
          </div>

          {filtersOpen ? (
            <div className="relative mt-3 border-t border-white/[0.06] pt-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="collection-category" className={filterLabelClass}>
                    Категория
                  </label>
                  <div className="relative">
                    <select
                      id="collection-category"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full cursor-pointer appearance-none rounded-lg border border-white/10 bg-black/35 py-2 pl-3 pr-9 text-[13px] text-zinc-100 focus:border-violet-400/45 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
                    >
                      <option value="">Все категории</option>
                      {categoryOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
                      aria-hidden
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <span
                    id="collection-sort-label"
                    className={filterLabelClass}
                  >
                    Цена
                  </span>
                  <div
                    className="flex rounded-lg border border-white/10 bg-black/35 p-0.5 shadow-inner shadow-black/25"
                    role="group"
                    aria-labelledby="collection-sort-label"
                  >
                    {(
                      [
                        ["default", "каталог"] as const,
                        ["asc", "↑"] as const,
                        ["desc", "↓"] as const,
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setPriceSort(value)}
                        title={
                          value === "default"
                            ? "Как в каталоге"
                            : value === "asc"
                              ? "По возрастанию цены"
                              : "По убыванию цены"
                        }
                        className={`flex-1 rounded-md px-1 py-1.5 text-center text-[11px] font-medium transition-all ${
                          priceSort === value
                            ? "bg-gradient-to-b from-violet-500/35 to-fuchsia-600/25 text-white shadow-[0_0_16px_rgba(139,92,246,0.2)] ring-1 ring-white/12"
                            : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <p className={filterLabelClass}>Тип</p>
                <div className="flex flex-wrap gap-1.5">
                  {typeChips.map(({ key, label, Icon }) => {
                    const on = typeFilter[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleType(key)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-all active:scale-[0.98] ${
                          on
                            ? "border-violet-400/45 bg-gradient-to-r from-violet-600/35 via-fuchsia-600/25 to-violet-600/30 text-white shadow-[0_0_18px_rgba(139,92,246,0.2)]"
                            : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-white/15 hover:bg-white/[0.06] hover:text-zinc-200"
                        }`}
                      >
                        <Icon
                          className={`h-3 w-3 shrink-0 ${
                            on ? "text-fuchsia-200/95" : "text-zinc-500"
                          }`}
                          aria-hidden
                        />
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[10px] leading-snug text-zinc-600">
                  Несколько тегов — по любому из них. Без выбора — все типы.
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                {hasActiveFilters ? (
                  <>
                    <p className="text-xs text-zinc-400">
                      Найдено{" "}
                      <span className="bg-gradient-to-r from-violet-200 to-fuchsia-300 bg-clip-text text-base font-semibold tabular-nums text-transparent">
                        {filteredSorted.length}
                      </span>
                      <span className="text-zinc-600"> / </span>
                      <span className="tabular-nums text-zinc-500">
                        {cards.length}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-zinc-300 transition hover:border-violet-400/35 hover:bg-violet-500/10 hover:text-white"
                    >
                      <RotateCcw className="h-3 w-3" aria-hidden />
                      Сбросить
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-zinc-500">
                    В каталоге{" "}
                    <span className="bg-gradient-to-r from-violet-200 to-fuchsia-300 bg-clip-text font-semibold tabular-nums text-transparent">
                      {cards.length}
                    </span>{" "}
                    {cards.length === 1 ? "карточка" : "карточек"}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {filteredSorted.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-500">
          Ничего не найдено — измените фильтры или поиск.
        </p>
      ) : (
        <div ref={collectionMeasureRef} className={sectionStack}>
          {sections
            .map((cat) => {
              const rawSection = filteredSorted.filter(
                (c) => (c.category?.trim() ?? "") === cat.name
              );
              const sectionCards =
                priceSort === "default"
                  ? sortSectionCardsForDefaultCatalog(rawSection, cards)
                  : rawSection;
              return { cat, sectionCards };
            })
            .filter(
              ({ sectionCards }) =>
                sectionCards.length > 0 || !hasActiveFilters
            )
            .map(({ cat, sectionCards }) => {
            const sectionId = collectionSectionId(cat.name);
            const expanded = expandedCategoryRows[cat.name] ?? false;
            const canCollapseRow =
              useCategoryRowPreview &&
              sectionCards.length > previewCols;
            const cardsToRender =
              canCollapseRow && !expanded
                ? sectionCards.slice(0, previewCols)
                : sectionCards;
            const restCount =
              canCollapseRow && !expanded
                ? sectionCards.length - previewCols
                : 0;

            return (
              <section
                key={cat.name}
                id={sectionId}
                className="scroll-mt-24"
                aria-labelledby={`${sectionId}-heading`}
              >
                {/*
                  Плашка на всю ширину окна: выходим из padding/max-width секции «Коллекции».
                */}
                <div
                  className="relative left-1/2 z-0 w-screen max-w-[100vw] -translate-x-1/2"
                  role="presentation"
                >
                  <CategoryRowBanner
                    cat={cat}
                    sectionId={sectionId}
                    compact={viewportCompact}
                  />
                </div>

                {sectionCards.length > 0 ? (
                  <>
                    <div
                      className={`collection-card-grid min-w-0 ${
                        viewportCompact
                          ? "collection-card-grid--viewport-compact mt-2"
                          : "mt-8"
                      }`}
                    >
                      {cardsToRender.map((card) => (
                        <div
                          key={card.id}
                          className="flex h-full min-h-0 min-w-0"
                        >
                          <CardPreview card={card} hideUltraLayer />
                        </div>
                      ))}
                    </div>
                    {canCollapseRow ? (
                      <div
                        className={`flex justify-center ${
                          viewportCompact ? "mt-3" : "mt-6"
                        }`}
                      >
                        {expanded ? (
                          <button
                            type="button"
                            onClick={() => setCategoryExpanded(cat.name, false)}
                            className="rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
                          >
                            Свернуть
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCategoryExpanded(cat.name, true)}
                            className="rounded-full border border-violet-500/35 bg-violet-950/35 px-5 py-2.5 text-sm font-semibold text-violet-100 shadow-[0_0_24px_rgba(139,92,246,0.15)] transition hover:border-violet-400/55 hover:bg-violet-900/45"
                          >
                            Смотреть ещё
                            {restCount > 0 ? (
                              <span className="ml-1.5 tabular-nums text-violet-200/90">
                                ({restCount})
                              </span>
                            ) : null}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="site-text-muted mt-6 text-center text-sm">
                    В этом разделе пока нет карточек.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
