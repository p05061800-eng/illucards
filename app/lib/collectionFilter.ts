import type { StoredCard } from "@/app/api/cards/route";
import { effectiveCardPriceByn } from "@/app/lib/formatPrice";

export type PriceSort = "default" | "asc" | "desc";

/** Чекбоксы типа карточки; если ни один не включён — тип не фильтруем. */
export type TypeFilterState = {
  adult: boolean;
  limited: boolean;
  common: boolean;
  replica: boolean;
  hotPrice: boolean;
  novelties: boolean;
};

export const EMPTY_TYPE_FILTER: TypeFilterState = {
  adult: false,
  limited: false,
  common: false,
  replica: false,
  hotPrice: false,
  novelties: false,
};

function anyTypeFilterOn(f: TypeFilterState): boolean {
  return (
    f.adult ||
    f.limited ||
    f.common ||
    f.replica ||
    f.hotPrice ||
    f.novelties
  );
}

export function cardMatchesTypeFilters(
  card: StoredCard,
  f: TypeFilterState
): boolean {
  if (!anyTypeFilterOn(f)) return true;
  if (f.adult && card.rarity === "adult") return true;
  if (f.limited && card.rarity === "limited") return true;
  if (f.common && card.rarity === "common") return true;
  if (f.replica && card.rarity === "replica") return true;
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
  if (sort === "asc")
    copy.sort(
      (a, b) =>
        effectiveCardPriceByn(a) - effectiveCardPriceByn(b)
    );
  else
    copy.sort(
      (a, b) =>
        effectiveCardPriceByn(b) - effectiveCardPriceByn(a)
    );
  return copy;
}

/**
 * Порядок карточек внутри секции категории при сортировке «по умолчанию»:
 * сначала по `categoryOrder`, без номера — как в исходном массиве каталога.
 */
export function sortSectionCardsForDefaultCatalog(
  sectionCards: StoredCard[],
  globalCardsInFileOrder: StoredCard[]
): StoredCard[] {
  const idx = new Map(globalCardsInFileOrder.map((c, i) => [c.id, i]));
  return [...sectionCards].sort((a, b) => {
    const oa = a.categoryOrder;
    const ob = b.categoryOrder;
    if (oa != null && ob != null && oa !== ob) return oa - ob;
    if (oa != null && ob == null) return -1;
    if (oa == null && ob != null) return 1;
    return (idx.get(a.id) ?? 0) - (idx.get(b.id) ?? 0);
  });
}

/**
 * Порядок листания по всему каталогу на странице товара: категория (A–Я), внутри — `categoryOrder`, затем порядок в файле.
 */
export function sortCardsForGalleryBrowse(
  cards: StoredCard[],
  globalCardsInFileOrder: StoredCard[]
): StoredCard[] {
  const idx = new Map(globalCardsInFileOrder.map((c, i) => [c.id, i]));
  return [...cards].sort((a, b) => {
    const ca = (a.category ?? "")
      .trim()
      .localeCompare((b.category ?? "").trim(), "ru");
    if (ca !== 0) return ca;
    const oa = a.categoryOrder;
    const ob = b.categoryOrder;
    if (oa != null && ob != null && oa !== ob) return oa - ob;
    if (oa != null && ob == null) return -1;
    if (oa == null && ob != null) return 1;
    return (idx.get(a.id) ?? 0) - (idx.get(b.id) ?? 0);
  });
}
