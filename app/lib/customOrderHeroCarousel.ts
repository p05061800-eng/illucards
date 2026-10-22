import type { StoredCard } from "@/app/api/cards/route";
import { CUSTOM_ORDER_CATEGORY_NAME } from "@/app/lib/categoriesJson";
import { sortSectionCardsForDefaultCatalog } from "@/app/lib/collectionFilter";

const CUSTOM_ORDER_CAROUSEL_MAX = 12;

function hasFront(card: StoredCard): boolean {
  return Boolean(card.frontImage?.trim());
}

function hasVarioPair(card: StoredCard): boolean {
  const f = card.frontImage?.trim() ?? "";
  const b = card.backImage?.trim() ?? "";
  return Boolean(f && b && b !== f);
}

/**
 * Карусель «Карточка на заказ»: сначала карточки этой категории (как в каталоге),
 * затем другие карточки с лицом/оборотом — тот же Vario, без дубликатов записей.
 */
export function buildCustomOrderHeroCards(cards: StoredCard[]): StoredCard[] {
  const inCategory = cards.filter((c) => {
    const cat = (c.category?.trim() ?? "").toLowerCase();
    return cat === CUSTOM_ORDER_CATEGORY_NAME.toLowerCase() && hasFront(c);
  });
  const primary = sortSectionCardsForDefaultCatalog(inCategory, cards);
  if (primary.length >= CUSTOM_ORDER_CAROUSEL_MAX) {
    return primary.slice(0, CUSTOM_ORDER_CAROUSEL_MAX);
  }

  const used = new Set(primary.map((c) => c.id));
  const extras = sortSectionCardsForDefaultCatalog(
    cards.filter(
      (c) =>
        !used.has(c.id) &&
        c.inStock !== false &&
        hasFront(c) &&
        hasVarioPair(c),
    ),
    cards,
  );

  const out = [...primary];
  for (const card of extras) {
    if (out.length >= CUSTOM_ORDER_CAROUSEL_MAX) break;
    out.push(card);
  }
  return out;
}
