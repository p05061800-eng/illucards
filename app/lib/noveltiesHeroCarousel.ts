import type { StoredCard } from "@/app/api/cards/route";
import { cardHasRarityTag } from "@/app/lib/cardRarityTags";

/** Если в каталоге есть категория с таким именем — карусель «Новинки» берёт все её карточки. */
export const NOVELTIES_CATEGORY_NAME = "Новинки";

export type NoveltiesCarouselOrder = {
  /** Явный порядок id в карусели; если пусто — все из пула по умолчанию. */
  cardIds?: string[];
};

/**
 * Полный список карточек для карусели «Новинки» в герое:
 * приоритет — все карточки категории «Новинки», иначе все с isNew / rarity novelty.
 * Если заданы `cardIds`, они идут первыми по порядку, затем остальные из пула.
 */
export function buildNoveltiesCarouselCards(
  cards: StoredCard[],
  order?: NoveltiesCarouselOrder
): StoredCard[] {
  const inCategory = cards.filter(
    (c) => (c.category?.trim() ?? "") === NOVELTIES_CATEGORY_NAME
  );
  const pool =
    inCategory.length > 0
      ? inCategory
      : cards.filter((c) => c.isNew || cardHasRarityTag(c, "novelty"));

  const ids = order?.cardIds?.filter(Boolean) ?? [];
  if (ids.length === 0) return pool;

  const allCardsMap = new Map(cards.map((c) => [c.id, c]));
  const out: StoredCard[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    const c = allCardsMap.get(id);
    if (c && !seen.has(c.id)) {
      seen.add(c.id);
      out.push(c);
    }
  }

  for (const c of pool) {
    if (!seen.has(c.id)) out.push(c);
  }

  return out;
}
