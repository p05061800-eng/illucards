import type { StoredCard } from "@/app/api/cards/route";
import { CUSTOM_ORDER_CATEGORY_NAME } from "@/app/lib/categoriesJson";
import { sortSectionCardsForDefaultCatalog } from "@/app/lib/collectionFilter";

function hasFront(card: StoredCard): boolean {
  return Boolean(card.frontImage?.trim());
}

/**
 * Карусель «Карточка на заказ»: только карточки этой категории из админки.
 */
export function buildCustomOrderHeroCards(cards: StoredCard[]): StoredCard[] {
  const inCategory = cards.filter((c) => {
    const cat = (c.category?.trim() ?? "").toLowerCase();
    return cat === CUSTOM_ORDER_CATEGORY_NAME.toLowerCase() && hasFront(c);
  });
  return sortSectionCardsForDefaultCatalog(inCategory, cards);
}
