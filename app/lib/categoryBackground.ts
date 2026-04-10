import {
  categories,
  categoryNameForSlug,
  slugForCategoryName,
} from "../../data/categories";

/** Фон витрины по каноническому имени категории */
export const CATEGORY_BACKGROUNDS: Record<string, string> = Object.fromEntries(
  categories.map((c) => [c.name, `/backgrounds/${c.slug}.jpg`])
);

const LEGACY_BACKGROUNDS: Record<string, string> = {
  "spider-man": "/backgrounds/marvel.jpg",
  tmnt: "/backgrounds/tmnt.jpg",
  "stranger-things": "/backgrounds/stranger-things.jpg",
};

export function getCategoryBackgroundUrl(
  category: string | undefined
): string | null {
  const c = category?.trim();
  if (!c) return null;
  if (CATEGORY_BACKGROUNDS[c]) return CATEGORY_BACKGROUNDS[c];
  const nameFromSlug = categoryNameForSlug(c);
  if (nameFromSlug && CATEGORY_BACKGROUNDS[nameFromSlug]) {
    return CATEGORY_BACKGROUNDS[nameFromSlug];
  }
  const slugFromStoredName = slugForCategoryName(c);
  if (slugFromStoredName) {
    const canon = categoryNameForSlug(slugFromStoredName);
    if (canon && CATEGORY_BACKGROUNDS[canon]) {
      return CATEGORY_BACKGROUNDS[canon];
    }
  }
  return LEGACY_BACKGROUNDS[c] ?? null;
}

/** Дополнительный тёмный градиент поверх размытого фото */
export function getCategoryTintStyle(category: string | undefined): string {
  const c = category?.trim() ?? "";
  const slug = slugForCategoryName(c) ?? "";
  if (slug === "stranger-things" || c === "stranger-things") {
    return [
      "linear-gradient(165deg, rgba(69,10,10,0.75) 0%, transparent 42%)",
      "linear-gradient(180deg, transparent 35%, rgba(0,0,0,0.88) 100%)",
      "radial-gradient(ellipse 90% 70% at 50% 110%, rgba(185,28,28,0.35), transparent 55%)",
    ].join(", ");
  }
  if (slug === "tmnt" || c === "tmnt") {
    return [
      "linear-gradient(195deg, rgba(6,78,59,0.55) 0%, transparent 48%)",
      "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.82) 100%)",
      "radial-gradient(ellipse 80% 50% at 20% 80%, rgba(34,197,94,0.12), transparent 50%)",
    ].join(", ");
  }
  if (slug === "marvel" || c === "spider-man" || c === "Marvel") {
    return [
      "linear-gradient(180deg, rgba(30,27,75,0.55) 0%, transparent 48%)",
      "linear-gradient(180deg, transparent 38%, rgba(0,0,0,0.85) 100%)",
      "radial-gradient(ellipse 100% 60% at 50% 0%, rgba(59,130,246,0.18), transparent 50%)",
    ].join(", ");
  }
  return "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, transparent 45%, rgba(0,0,0,0.9) 100%)";
}
