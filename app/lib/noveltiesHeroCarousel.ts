import type { StoredCard } from "@/app/api/cards/route";
import { cardHasRarityTag } from "@/app/lib/cardRarityTags";
import {
  inferNoveltySinceMsFromUploadPath,
  parseNoveltySinceMs,
} from "@/app/lib/noveltyExpiry";

export type NoveltiesCarouselOrder = {
  /** Явный порядок id в карусели; если пусто — все из пула по умолчанию. */
  cardIds?: string[];
};

function noveltySortKey(card: StoredCard): number {
  return (
    parseNoveltySinceMs(card.noveltySince) ??
    inferNoveltySinceMsFromUploadPath(card.frontImage) ??
    0
  );
}

export function isHeroNoveltyCard(card: StoredCard): boolean {
  if (!card.frontImage?.trim()) return false;
  return card.isNew || cardHasRarityTag(card, "novelty");
}

/** Новинки в герое: сначала свежие, затем по порядку в файле. */
export function sortNoveltiesForHeroCarousel(
  cards: StoredCard[],
  globalCardsInFileOrder: StoredCard[],
): StoredCard[] {
  const idx = new Map(globalCardsInFileOrder.map((c, i) => [c.id, i]));
  return [...cards].sort((a, b) => {
    const tb = noveltySortKey(b);
    const ta = noveltySortKey(a);
    if (tb !== ta) return tb - ta;
    return (idx.get(a.id) ?? 0) - (idx.get(b.id) ?? 0);
  });
}

/**
 * Полный список карточек для карусели «Новинки» в герое:
 * все с активной меткой «Новинки» (не старше 30 дней) или флагом isNew.
 * Если заданы `cardIds`, они идут первыми по порядку, затем остальные из пула.
 */
export function buildNoveltiesCarouselCards(
  cards: StoredCard[],
  order?: NoveltiesCarouselOrder,
): StoredCard[] {
  const pool = cards.filter((c) => isHeroNoveltyCard(c));

  const ids = order?.cardIds?.filter(Boolean) ?? [];
  if (ids.length === 0) {
    return sortNoveltiesForHeroCarousel(pool, cards);
  }

  const allCardsMap = new Map(cards.map((c) => [c.id, c]));
  const out: StoredCard[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    const c = allCardsMap.get(id);
    if (c && isHeroNoveltyCard(c) && !seen.has(c.id)) {
      seen.add(c.id);
      out.push(c);
    }
  }

  for (const c of pool) {
    if (!seen.has(c.id)) out.push(c);
  }

  return out;
}
