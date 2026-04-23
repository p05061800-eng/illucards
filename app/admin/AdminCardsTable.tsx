"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { StoredCard } from "../api/cards/route";
import { ultraOrHeroBgUrl } from "../lib/cardUltraBg";
import { categoryLabel } from "../lib/categoryLabels";
import { categories } from "../../data/categories";
import { CardStackVisual } from "@/components/hero/CardStackVisual";

const CATEGORY_SORT_INDEX = new Map<string, number>(
  categories.map((c, i) => [c.name, i]),
);

function orderedCategoryKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    if (a === "Без категории") return 1;
    if (b === "Без категории") return -1;
    const ia = CATEGORY_SORT_INDEX.get(a) ?? 1000;
    const ib = CATEGORY_SORT_INDEX.get(b) ?? 1000;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b, "ru");
  });
}

function sortCardsInCategory(list: readonly StoredCard[]): StoredCard[] {
  return [...list].sort((a, b) => {
    const oa = a.categoryOrder ?? 9999;
    const ob = b.categoryOrder ?? 9999;
    if (oa !== ob) return oa - ob;
    return (a.title || "").localeCompare(b.title || "", "ru");
  });
}

function cardMatchesQuery(card: StoredCard, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  if ((card.title ?? "").toLowerCase().includes(n)) return true;
  if (card.id.toLowerCase().includes(n)) return true;
  if ((card.category ?? "").toLowerCase().includes(n)) return true;
  if (categoryLabel(card.category).toLowerCase().includes(n)) return true;
  return false;
}

function AdminCardVisualTile({
  card,
  onEdit,
  deleteCard,
}: {
  card: StoredCard;
  onEdit: (c: StoredCard) => void;
  deleteCard: (id: string) => void | Promise<void>;
}) {
  return (
    <div className="group/card relative min-w-0">
      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-0.5 px-0.5 pt-0.5">
        <div className="flex min-w-0 flex-1 flex-wrap gap-0.5">
          <Link
            href={`/card/${card.id}`}
            className="shrink-0 rounded border border-white/20 bg-black/85 px-1 py-0.5 text-[9px] font-medium leading-none text-violet-200 backdrop-blur-sm transition hover:border-violet-400/50 hover:text-white"
            target="_blank"
            rel="noreferrer"
            title="Открыть на сайте"
            onClick={(e) => e.stopPropagation()}
          >
            Сайт
          </Link>
          <button
            type="button"
            className="shrink-0 rounded border border-white/20 bg-black/85 px-1 py-0.5 text-[9px] font-medium leading-none text-amber-200 backdrop-blur-sm transition hover:border-amber-400/50"
            title="Редактировать"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(card);
            }}
          >
            Правка
          </button>
        </div>
        <button
          type="button"
          className="shrink-0 rounded border border-red-500/40 bg-red-950/90 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-red-100 shadow-sm backdrop-blur-sm transition hover:border-red-400 hover:bg-red-900/95"
          title="Удалить из каталога"
          onClick={(e) => {
            e.stopPropagation();
            void deleteCard(card.id);
          }}
        >
          Удалить
        </button>
      </div>
      <button
        type="button"
        onClick={() => onEdit(card)}
        className="relative block w-full min-w-0 cursor-pointer rounded-xl pt-5 text-left ring-1 ring-white/10 transition hover:ring-violet-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
        title={card.title}
        aria-label={`Редактировать: ${card.title}`}
      >
        <CardStackVisual
          card={card}
          ultraBgUrl={ultraOrHeroBgUrl(card)}
          catalogStack
          hideUltraLayer
          rootClassName="relative mx-auto max-w-full rounded-xl"
        />
      </button>
    </div>
  );
}

type Props = {
  cards: StoredCard[];
  deleteCard: (id: string) => void | Promise<void>;
  onEdit: (card: StoredCard) => void;
};

export function AdminCardsTable({ cards, deleteCard, onEdit }: Props) {
  const [query, setQuery] = useState("");

  const filteredCards = useMemo(() => {
    const n = query.trim().toLowerCase();
    if (!n) return cards;
    return cards.filter((c) => cardMatchesQuery(c, n));
  }, [cards, query]);

  const groups = useMemo(() => {
    const m = new Map<string, StoredCard[]>();
    for (const c of filteredCards) {
      const raw = c.category?.trim();
      const key = raw && raw.length > 0 ? raw : "Без категории";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(c);
    }
    return orderedCategoryKeys([...m.keys()]).map((name) => ({
      name,
      cards: sortCardsInCategory(m.get(name)!),
    }));
  }, [filteredCards]);

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-10 text-center text-sm text-zinc-500">
        Пока нет карточек. Добавьте первую в форме выше.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="group relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по названию, id, категории…"
          autoComplete="off"
          aria-label="Поиск по карточкам"
          className="w-full rounded-lg border border-white/10 bg-black/50 py-1.5 pl-8 pr-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-violet-400/40 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
        />
      </div>

      {filteredCards.length === 0 ? (
        <p className="rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-center text-xs text-amber-200/90">
          Ничего не найдено — сбросьте поиск или измените запрос.
        </p>
      ) : null}

      <div className="space-y-4">
        {groups.map(({ name, cards: rows }, sectionIdx) => (
          <section
            key={name}
            className="rounded-xl border border-white/10 bg-zinc-950/40 p-3"
            aria-labelledby={`admin-category-${sectionIdx}`}
          >
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
              <h3
                id={`admin-category-${sectionIdx}`}
                className="truncate text-xs font-semibold text-zinc-200"
              >
                {categoryLabel(name)}
              </h3>
              <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
                {rows.length} шт.
              </span>
            </div>
            <div
              className="grid w-full auto-rows-min gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(4.25rem,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(4.75rem,1fr))] md:[grid-template-columns:repeat(auto-fill,minmax(5.25rem,1fr))] lg:[grid-template-columns:repeat(auto-fill,minmax(5.5rem,1fr))]"
            >
              {rows.map((card) => (
                <AdminCardVisualTile
                  key={card.id}
                  card={card}
                  onEdit={onEdit}
                  deleteCard={deleteCard}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
