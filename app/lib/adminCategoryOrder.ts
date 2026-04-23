import type { StoredCard } from "@/app/api/cards/route";

/** Максимальный `categoryOrder` среди карточек этой категории (для подсказки «следующий номер»). */
export function maxCategoryOrderInCategory(
  cards: StoredCard[],
  category: string
): number {
  const cat = category.trim();
  let max = 0;
  for (const c of cards) {
    if ((c.category?.trim() ?? "") !== cat) continue;
    const o = c.categoryOrder;
    if (o != null && o > max) max = o;
  }
  return max;
}
