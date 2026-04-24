import type { StoredCard } from "@/app/api/cards/route";
import type { SpotlightSlideRow } from "@/app/lib/spotlightJson";

/** Если в каталоге есть категория с таким именем — карусель «Новинки» берёт все её карточки. */
export const NOVELTIES_CATEGORY_NAME = "Новинки";

/**
 * Полный список карточек для карусели героя на слайде «Новинки»:
 * приоритет — все карточки категории «Новинки», иначе все с isNew / rarity novelty.
 * Если в слайде заданы `cardIds`, они идут первыми по порядку, затем остальные из пула.
 */
export function buildNoveltiesCarouselCards(
  cards: StoredCard[],
  slide: SpotlightSlideRow | undefined
): StoredCard[] {
  if (!slide || slide.kind !== "novelties") return [];

  const inCategory = cards.filter(
    (c) => (c.category?.trim() ?? "") === NOVELTIES_CATEGORY_NAME
  );
  const pool =
    inCategory.length > 0
      ? inCategory
      : cards.filter((c) => c.isNew || c.rarity === "novelty");

  const ids = slide.cardIds?.filter(Boolean) ?? [];
  if (ids.length === 0) return pool;

  const map = new Map(pool.map((c) => [c.id, c]));
  const out: StoredCard[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const c = map.get(id);
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
