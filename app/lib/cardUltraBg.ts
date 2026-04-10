import type { StoredCard } from "@/app/api/cards/route";
import { categories, slugForCategoryName } from "@/data/categories";

const heroBackgrounds: Record<string, string> = Object.fromEntries(
  categories.map((c) => [c.name, `/backgrounds/hero-${c.slug}.jpg`])
);

const ultraBackgrounds: Record<string, string> = Object.fromEntries(
  categories.map((c) => [c.name, `/backgrounds/ultra-${c.slug}.jpg`])
);

/**
 * URL третьего слоя (наклон сзади): ultra → hero → дефолт по категории.
 * Отображение везде через `CardStackVisual`: рамка 3:4, картинка с `object-fit: cover`.
 */
export function ultraOrHeroBgUrl(card: StoredCard): string {
  const u = card.ultraBg?.trim();
  if (u) return u;
  const h = card.heroBg?.trim();
  if (h) return h;
  const ultra = ultraBackgrounds[card.category];
  if (ultra) return ultra;
  const hero = heroBackgrounds[card.category];
  if (hero) return hero;
  const slug =
    slugForCategoryName(card.category) ??
    card.category.toLowerCase().replace(/\s+/g, "-");
  return `/backgrounds/ultra-${slug}.jpg`;
}
