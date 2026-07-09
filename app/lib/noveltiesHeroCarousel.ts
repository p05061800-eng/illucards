import type { StoredCard } from "@/app/api/cards/route";
import { cardHasRarityTag } from "@/app/lib/cardRarityTags";

export type NoveltiesCarouselOrder = {
  /** Явный порядок id в карусели; если пусто — все из пула по умолчанию. */
  cardIds?: string[];
};

function isActiveNoveltyCard(card: StoredCard): boolean {
  return cardHasRarityTag(card, "novelty");
}

/**
 * Полный список карточек для карусели «Новинки» в герое:
 * все карточки с активной меткой «Новинки» (не старше 30 дней).
 * Если заданы `cardIds`, они идут первыми по порядку, затем остальные из пула.
 */
export function buildNoveltiesCarouselCards(
  cards: StoredCard[],
  order?: NoveltiesCarouselOrder
): StoredCard[] {
  const pool = cards.filter((c) => isActiveNoveltyCard(c));

  const ids = order?.cardIds?.filter(Boolean) ?? [];
  if (ids.length === 0) return pool;

  const allCardsMap = new Map(cards.map((c) => [c.id, c]));
  const out: StoredCard[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    const c = allCardsMap.get(id);
    if (c && isActiveNoveltyCard(c) && !seen.has(c.id)) {
      seen.add(c.id);
      out.push(c);
    }
  }

  for (const c of pool) {
    if (!seen.has(c.id)) out.push(c);
  }

  return out;
}
