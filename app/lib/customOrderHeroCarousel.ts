import type { StoredCard } from "@/app/api/cards/route";
import { CUSTOM_ORDER_CATEGORY_NAME } from "@/app/lib/categoriesJson";
import { sortSectionCardsForDefaultCatalog } from "@/app/lib/collectionFilter";

function hasFront(card: StoredCard): boolean {
  return Boolean(card.frontImage?.trim());
}

function isCustomOrderCategory(category: string | undefined): boolean {
  const cat = (category?.trim() ?? "").toLowerCase();
  if (!cat) return false;
  if (cat === CUSTOM_ORDER_CATEGORY_NAME.toLowerCase()) return true;
  return cat.includes("на заказ");
}

/**
 * Карусель «Карточка на заказ»: только карточки этой категории из админки.
 */
export function buildCustomOrderHeroCards(cards: StoredCard[]): StoredCard[] {
  const inCategory = cards.filter(
    (c) => isCustomOrderCategory(c.category) && hasFront(c),
  );
  return sortSectionCardsForDefaultCatalog(inCategory, cards);
}

/** Если в категории пусто, но fallback — это лицо/оборот карточки каталога, берём её (Vario). */
export function resolveCustomOrderHeroCards(
  cards: StoredCard[],
  fallbackImageUrl?: string,
): StoredCard[] {
  const fromCat = buildCustomOrderHeroCards(cards);
  if (fromCat.length > 0) return fromCat;
  const url = fallbackImageUrl?.trim() ?? "";
  if (!url) return [];
  const hit = cards.find((c) => {
    if (!hasFront(c)) return false;
    return c.frontImage?.trim() === url || c.backImage?.trim() === url;
  });
  return hit ? [hit] : [];
}
