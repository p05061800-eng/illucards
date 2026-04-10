import type { StoredCard } from "@/app/api/cards/route";

export type PriceSort = "default" | "asc" | "desc";

/** Чекбоксы типа карточки; если ни один не включён — тип не фильтруем. */
export type TypeFilterState = {
  adult: boolean;
  limited: boolean;
  common: boolean;
  hotPrice: boolean;
  novelties: boolean;
};

export const EMPTY_TYPE_FILTER: TypeFilterState = {
  adult: false,
  limited: false,
  common: false,
  hotPrice: false,
  novelties: false,
};

function anyTypeFilterOn(f: TypeFilterState): boolean {
  return f.adult || f.limited || f.common || f.hotPrice || f.novelties;
}

export function cardMatchesTypeFilters(
  card: StoredCard,
  f: TypeFilterState
): boolean {
  if (!anyTypeFilterOn(f)) return true;
  if (f.adult && card.rarity === "adult") return true;
  if (f.limited && card.rarity === "limited") return true;
  if (f.common && card.rarity === "common") return true;
  if (f.hotPrice && card.rarity === "hot_price") return true;
  if (f.novelties && (card.isNew || card.rarity === "novelty")) return true;
  return false;
}

export function cardMatchesSearch(card: StoredCard, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const parts = [
    card.title,
    card.description,
    card.subcategory,
    card.category,
  ].map((s) => (s ?? "").toLowerCase());
  return parts.some((s) => s.includes(t));
}

export function filterCollectionCards(
  cards: StoredCard[],
  opts: {
    search: string;
    category: string;
    typeFilter: TypeFilterState;
  }
): StoredCard[] {
  const cat = opts.category.trim();
  return cards.filter((c) => {
    if (!cardMatchesSearch(c, opts.search)) return false;
    if (cat && (c.category?.trim() ?? "") !== cat) return false;
    if (!cardMatchesTypeFilters(c, opts.typeFilter)) return false;
    return true;
  });
}

export function sortCardsByPrice(
  cards: StoredCard[],
  sort: PriceSort
): StoredCard[] {
  if (sort === "default") return cards;
  const copy = [...cards];
  if (sort === "asc") copy.sort((a, b) => a.price - b.price);
  else copy.sort((a, b) => b.price - a.price);
  return copy;
}
