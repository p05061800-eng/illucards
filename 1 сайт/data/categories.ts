/**
 * Канонические категории витрины: в `cards.json` поле `category` = `name` (как в UI).
 * Slug используется в данных и API; страницы категорий в приложении нет.
 * `image` — обложка для Netflix-слайдера (`public/categories/...`).
 * `glow` — цвет для hover-свечения плитки (rgba).
 */

export const categories = [
  {
    name: "Marvel",
    slug: "marvel",
    image: "/categories/marvel.jpg",
    glow: "rgba(255, 80, 0, 0.65)",
  },
  {
    name: "DC",
    slug: "dc",
    image: "/categories/dc.jpg",
    glow: "rgba(59, 130, 246, 0.65)",
  },
  {
    name: "TMNT",
    slug: "tmnt",
    image: "/categories/tmnt.jpg",
    glow: "rgba(34, 197, 94, 0.65)",
  },
  {
    name: "Stranger Things",
    slug: "stranger-things",
    image: "/categories/stranger.jpg",
    glow: "rgba(185, 28, 28, 0.7)",
  },
  {
    name: "Anime",
    slug: "anime",
    image: "/categories/anime.jpg",
    glow: "rgba(168, 85, 247, 0.65)",
  },
  {
    name: "Cars",
    slug: "cars",
    image: "/categories/cars.jpg",
    glow: "rgba(148, 163, 184, 0.65)",
  },
  {
    name: "Pokemon",
    slug: "pokemon",
    image: "/categories/pokemon.jpg",
    glow: "rgba(250, 204, 21, 0.65)",
  },
  {
    name: "Football",
    slug: "football",
    image: "/categories/football.jpg",
    glow: "rgba(16, 185, 129, 0.65)",
  },
] as const;

export type CatalogCategory = (typeof categories)[number];
export type CategorySlug = CatalogCategory["slug"];

export const CATEGORY_SLUGS: CategorySlug[] = categories.map((c) => c.slug);

export const CATEGORY_FILTER_IDS = ["all", ...CATEGORY_SLUGS] as const;
export type CategoryFilterId = (typeof CATEGORY_FILTER_IDS)[number];

export function categoryNameForSlug(slug: string): string | undefined {
  return categories.find((c) => c.slug === slug)?.name;
}

export function slugForCategoryName(name: string): string | undefined {
  const n = name.trim();
  const byName = categories.find((c) => c.name === n)?.slug;
  if (byName) return byName;
  const nl = n.toLowerCase();
  const byNameInsensitive = categories.find(
    (c) => c.name.toLowerCase() === nl,
  )?.slug;
  if (byNameInsensitive) return byNameInsensitive;
  if (n === "Очень странные дела") return "stranger-things";
  return undefined;
}

export function categoryFilterLabel(id: CategoryFilterId): string {
  if (id === "all") return "Все";
  return categoryNameForSlug(id) ?? id;
}

/** Фильтр каталога: совпадение с каноническим `name` + legacy Marvel. */
export function cardMatchesCategorySlug(
  cardCategory: string,
  filterId: CategoryFilterId
): boolean {
  if (filterId === "all") return true;
  const expectedName = categoryNameForSlug(filterId);
  if (!expectedName) return false;
  const c = cardCategory.trim();
  if (c === expectedName) return true;
  if (filterId === "stranger-things" && c === "Очень странные дела") {
    return true;
  }
  if (filterId === "marvel") {
    const cl = c.toLowerCase();
    return cl === "marvel" || cl === "spider-man";
  }
  return false;
}
