import type { StoredCard } from "@/app/api/cards/route";
import { categories, slugForCategoryName } from "@/data/categories";

const heroBackgrounds: Record<string, string> = Object.fromEntries(
  categories.map((c) => [c.name, `/backgrounds/hero-${c.slug}.jpg`])
);

const ultraBackgrounds: Record<string, string> = Object.fromEntries(
  categories.map((c) => [c.name, `/backgrounds/ultra-${c.slug}.jpg`])
);

/**
 * URL третьего слоя (наклон сзади): ultra → hero → **фон категории из админки** (`categoryBg`)
 * → статические ultra/hero по категории.
 * Отображение везде через `CardStackVisual`: рамка по пропорциям лица, третий слой — `object-fit: contain` (без обрезки).
 */
export function ultraOrHeroBgUrlForCategoryName(categoryName: string): string {
  const c = categoryName.trim();
  const name = c || categories[0]?.name || "TMNT";
  return ultraOrHeroBgUrl({ category: name } as StoredCard);
}

export function ultraOrHeroBgUrl(card: StoredCard): string {
  const u = card.ultraBg?.trim();
  if (u) return u;
  const h = card.heroBg?.trim();
  if (h) return h;
  const catBg = card.categoryBg?.trim();
  if (catBg) return catBg;
  const ultra = ultraBackgrounds[card.category];
  if (ultra) return ultra;
  const hero = heroBackgrounds[card.category];
  if (hero) return hero;
  const slug =
    slugForCategoryName(card.category) ??
    card.category.toLowerCase().replace(/\s+/g, "-");
  return `/backgrounds/ultra-${slug}.jpg`;
}
