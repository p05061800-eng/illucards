"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { CardStackVisual } from "@/components/hero/CardStackVisual";
import CategorySlider from "@/components/ui/CategorySlider";
import { ultraOrHeroBgUrl } from "@/app/lib/cardUltraBg";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from "react";
import type { CardRarity, StoredCard } from "./api/cards/route";
import { PurchaseModal } from "./components/PurchaseModal";
import { RARITY_STYLES } from "./lib/cardRarityUi";
import { useCurrency } from "./context/CurrencyContext";
import { useAddToCartWithFeedback } from "./lib/cartUx/useAddToCartWithFeedback";
import { formatCardPrice } from "./lib/formatPrice";
import { categories } from "@/data/categories";
import { categoryLabel } from "./lib/categoryLabels";

type Props = {
  cards: StoredCard[];
};

const RARITY_LABELS: Record<CardRarity, string> = {
  common: "Обычная",
  limited: "Лимитированная",
  adult: "18+",
  novelty: "Новинки",
  hot_price: "Горячая цена",
};

const fieldClass =
  "w-full rounded-xl border border-white/10 bg-zinc-950/90 px-4 py-2.5 text-sm text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition placeholder:text-zinc-600 focus:border-purple-500/45 focus:outline-none focus:ring-2 focus:ring-purple-500/25";

function CardItem({
  card,
  onBuy,
  variant = "grid",
}: {
  card: StoredCard;
  onBuy: () => void;
  variant?: "grid" | "list";
}) {
  const addToCartWithFeedback = useAddToCartWithFeedback();
  const { currency } = useCurrency();

  const categoryDisplay = card.category
    ? categoryLabel(card.category)
    : "—";

  const rarity = card.rarity ?? "limited";
  const isList = variant === "list";

  return (
    <article
      className={
        isList
          ? "w-full max-w-4xl rounded-2xl border border-white/10 bg-zinc-950/40 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5"
          : "mx-auto w-full max-w-[154px]"
      }
    >
      <div
        className={
          isList
            ? "h-full [transform-style:preserve-3d]"
            : "flex flex-col rounded-2xl [transform-style:preserve-3d]"
        }
      >
        <div
          className={
            isList
              ? "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
              : "flex flex-col"
          }
        >
        <Link
          href={`/card/${card.id}`}
          className={
            isList
              ? "group/card flex min-w-0 flex-1 cursor-pointer flex-row gap-4 rounded-xl p-0.5 transition-[filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:items-start"
              : "group/card flex cursor-pointer flex-col gap-2 rounded-2xl p-0.5 transition-[filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          }
        >
          <div
            className={
              isList ? "relative w-[104px] shrink-0 sm:w-[118px]" : "relative w-full"
            }
          >
            <div className="relative w-full [transform-style:preserve-3d]">
              <CardStackVisual
                card={card}
                ultraBgUrl={ultraOrHeroBgUrl(card)}
                catalogStack
                rootClassName="relative mx-auto aspect-[3/4] w-full rounded-2xl"
                dataCartFlySource
              />
            </div>
          <div
            className={`mt-3 w-full max-w-full animate-fade-up ${isList ? "text-left" : "text-center"}`}
          >
            <h3 className="text-lg font-semibold text-white">
              {card.title}
            </h3>
            <span
              className={`mt-0.5 block text-xs uppercase tracking-wide ${RARITY_STYLES[rarity]}`}
            >
              {RARITY_LABELS[rarity]}
            </span>
            <p className="mt-1 line-clamp-2 text-sm text-gray-400 transition animate-fade-up delay-100 group-hover/card:text-gray-200">
              {card.description?.trim() || "Описание скоро появится"}
            </p>
          </div>
        </div>

          <div
            className={
              isList
                ? "min-w-0 flex-1 px-0 text-left transition-[opacity,transform] duration-500 ease-out group-hover/card:translate-y-0"
                : "px-0.5 text-center transition-[opacity,transform] duration-500 ease-out group-hover/card:translate-y-0"
            }
          >
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-purple-400/90 transition-colors duration-300 group-hover/card:text-purple-300">
              {categoryDisplay}
            </p>
            <p
              className={
                isList
                  ? "mb-0 bg-gradient-to-r from-purple-200 to-violet-200 bg-clip-text text-sm font-semibold text-transparent tabular-nums"
                  : "mb-2.5 bg-gradient-to-r from-purple-200 to-violet-200 bg-clip-text text-[11px] font-semibold leading-snug text-transparent transition-opacity duration-300 group-hover/card:opacity-100 sm:text-xs"
              }
            >
              {formatCardPrice(card.price, currency)}
            </p>
          </div>
        </Link>

        <div
          className={
            isList
              ? "flex w-full shrink-0 flex-col gap-1.5 sm:w-[148px]"
              : "mt-0 flex w-full flex-col gap-1.5 px-0.5"
          }
        >
        <button
          type="button"
          onClick={(e) => {
            const article = e.currentTarget.closest("article");
            const source = article?.querySelector("[data-cart-fly-source]");
            addToCartWithFeedback(
              card,
              source ? (source as HTMLElement) : null
            );
          }}
          className="flex w-full items-center justify-center rounded-full bg-green-500 p-2 text-white transition-all duration-300 hover:shadow-lg hover:shadow-green-500/35 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          aria-label="В корзину"
        >
          <ShoppingBag className="h-5 w-5 text-white" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onBuy}
          className="relative w-full overflow-hidden rounded-full bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 py-2.5 text-xs font-semibold text-white shadow-[0_0_28px_rgba(168,85,247,0.55),0_0_56px_rgba(139,92,246,0.2)] ring-1 ring-purple-400/40 transition-all duration-300 ease-out before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-t before:from-transparent before:to-white/10 before:opacity-0 before:transition-opacity before:duration-300 hover:from-purple-500 hover:via-violet-500 hover:to-fuchsia-500 hover:shadow-[0_0_40px_rgba(192,132,252,0.75),0_0_80px_rgba(139,92,246,0.35)] hover:brightness-110 hover:ring-purple-300/50 hover:before:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/90 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <span className="relative z-10">Купить</span>
        </button>
        </div>
        </div>
      </div>
    </article>
  );
}

function matchesSearch(card: StoredCard, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const title = (card.title || "").toLowerCase();
  const desc = (card.description || "").toLowerCase();
  return title.includes(q) || desc.includes(q);
}

const RARITY_SORT: Record<CardRarity, number> = {
  common: 0,
  limited: 1,
  adult: 2,
  novelty: 3,
  hot_price: 4,
};

type SortMode = "popular" | "new" | "cheap";

function sortCards(
  list: StoredCard[],
  mode: SortMode,
  originalOrder: StoredCard[]
): StoredCard[] {
  const indexOfId = (id: string) =>
    originalOrder.findIndex((c) => c.id === id);
  const copy = [...list];
  if (mode === "cheap") {
    copy.sort(
      (a, b) =>
        a.price - b.price || (a.title || "").localeCompare(b.title || "", "ru")
    );
  } else if (mode === "new") {
    copy.sort((a, b) => indexOfId(b.id) - indexOfId(a.id));
  } else {
    copy.sort((a, b) => {
      const ra = RARITY_SORT[a.rarity ?? "limited"];
      const rb = RARITY_SORT[b.rarity ?? "limited"];
      if (rb !== ra) return rb - ra;
      return (a.title || "").localeCompare(b.title || "", "ru");
    });
  }
  return copy;
}

function cardsNoun(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "карточек";
  if (mod10 === 1) return "карточка";
  if (mod10 >= 2 && mod10 <= 4) return "карточки";
  return "карточек";
}

const catalogArrowBtnClass =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-zinc-950/85 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-purple-400/50 hover:bg-purple-950/55 hover:shadow-[0_0_28px_rgba(168,85,247,0.45)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/12 disabled:hover:bg-zinc-950/85 disabled:hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 sm:h-12 sm:w-12";

export default function HomeCards({ cards }: Props) {
  const [activeCategoryName, setActiveCategoryName] = useState<string>(
    categories[0].name
  );
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("popular");
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const filteredCards = useMemo(() => {
    const pool = cards.filter(
      (card) =>
        card.category === activeCategoryName &&
        matchesSearch(card, searchQuery)
    );
    return sortCards(pool, sortMode, cards);
  }, [cards, activeCategoryName, searchQuery, sortMode]);

  const activeCard = filteredCards[activeCardIndex];

  useEffect(() => {
    setActiveCardIndex(0);
  }, [activeCategoryName]);

  useEffect(() => {
    setActiveCardIndex((i) => {
      if (filteredCards.length === 0) return 0;
      return Math.min(i, filteredCards.length - 1);
    });
  }, [filteredCards]);

  const prevCategory = useCallback(() => {
    setActiveCategoryName((prev) => {
      const i = categories.findIndex((c) => c.name === prev);
      const cur = i === -1 ? 0 : i;
      const n = cur === 0 ? categories.length - 1 : cur - 1;
      return categories[n]!.name;
    });
  }, []);

  const nextCategory = useCallback(() => {
    setActiveCategoryName((prev) => {
      const i = categories.findIndex((c) => c.name === prev);
      const cur = i === -1 ? 0 : i;
      const n = cur === categories.length - 1 ? 0 : cur + 1;
      return categories[n]!.name;
    });
  }, []);

  const prevCard = useCallback(() => {
    if (filteredCards.length === 0) return;
    setActiveCardIndex((prev) =>
      prev === 0 ? filteredCards.length - 1 : prev - 1
    );
  }, [filteredCards.length]);

  const nextCard = useCallback(() => {
    if (filteredCards.length === 0) return;
    setActiveCardIndex((prev) =>
      prev === filteredCards.length - 1 ? 0 : prev + 1
    );
  }, [filteredCards.length]);

  const onTouchStartCatalog = useCallback((e: TouchEvent<HTMLDivElement>) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const onTouchEndCatalog = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      const th = 44;
      if (ax < th && ay < th) return;
      if (ax >= ay) {
        if (dx < 0) nextCard();
        else prevCard();
      } else {
        if (dy < 0) nextCategory();
        else prevCategory();
      }
    },
    [nextCard, prevCard, nextCategory, prevCategory]
  );

  if (cards.length === 0) {
    return (
      <div className="mx-auto w-full max-w-6xl px-3 py-16 text-center sm:px-4">
        <h2 className="bg-gradient-to-r from-white via-purple-100 to-violet-200 bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl">
          Каталог
        </h2>
        <p className="mx-auto mt-6 max-w-md text-zinc-500">
          Пока нет карточек.{" "}
          <span className="text-purple-400/90">Добавьте их в админке.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-3 sm:px-4">
      <PurchaseModal
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
      />

      <header className="w-full pb-4 pt-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-center sm:text-left">
            <h2 className="bg-gradient-to-r from-white via-purple-100 to-violet-200 bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl">
              Каталог
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-zinc-500 sm:mx-0">
              Премиальные 3D-карточки по вселенным
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex shrink-0 items-center justify-center self-end rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_28px_rgba(168,85,247,0.45)] ring-1 ring-purple-400/35 transition hover:from-purple-500 hover:via-violet-500 hover:to-fuchsia-500 hover:shadow-[0_0_48px_rgba(192,132,252,0.7),0_0_72px_rgba(139,92,246,0.35)] sm:self-start"
          >
            Добавить карточку
          </Link>
        </div>
      </header>

      <section
        aria-label="Поиск и сортировка"
        className="w-full max-w-4xl space-y-5 pb-8"
      >
        <div className="min-w-0">
          <label htmlFor="catalog-search" className="sr-only">
            Поиск карточек
          </label>
          <input
            id="catalog-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск в текущей категории..."
            autoComplete="off"
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <p className="text-sm text-zinc-500">
            В категории:{" "}
            <span className="font-semibold tabular-nums text-zinc-200">
              {filteredCards.length}
            </span>{" "}
            {cardsNoun(filteredCards.length)}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="catalog-sort" className="sr-only">
              Сортировка
            </label>
            <select
              id="catalog-sort"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className={`${fieldClass} min-w-[11rem] cursor-pointer`}
            >
              <option value="popular">Популярные</option>
              <option value="new">Новые</option>
              <option value="cheap">Дешевые</option>
            </select>
          </div>
        </div>
      </section>

      <section
        aria-label="Категория"
        className="w-full max-w-4xl pb-6 pt-2"
      >
        <CategorySlider
          behavior="callback"
          activeCategoryName={activeCategoryName}
          onSelect={(name) => {
            if (name) setActiveCategoryName(name);
          }}
        />
      </section>

      {filteredCards.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-500">
          {searchQuery.trim()
            ? "Ничего не найдено. Попробуйте другой запрос."
            : "В этой категории пока нет карточек."}
        </p>
      ) : (
        <section
          aria-label="Карточка"
          className="w-full max-w-4xl pb-16 pt-2"
          onTouchStart={onTouchStartCatalog}
          onTouchEnd={onTouchEndCatalog}
        >
          <p className="mb-6 text-center text-xs text-zinc-600 sm:text-sm">
            Свайп влево/вправо — карточки · вверх/вниз — категории
          </p>
          <div className="flex w-full items-start justify-center gap-2 sm:gap-6 md:items-center">
            <button
              type="button"
              className={catalogArrowBtnClass}
              aria-label="Предыдущая карточка"
              onClick={prevCard}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div
              key={activeCard?.id ?? "card"}
              className={`min-w-0 flex-1 ${
                activeCard ? "catalog-card-animate max-w-[min(100%,380px)]" : ""
              }`}
            >
              {activeCard ? (
                <CardItem
                  card={activeCard}
                  variant="grid"
                  onBuy={() => setPurchaseOpen(true)}
                />
              ) : null}
            </div>
            <button
              type="button"
              className={catalogArrowBtnClass}
              aria-label="Следующая карточка"
              onClick={nextCard}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
