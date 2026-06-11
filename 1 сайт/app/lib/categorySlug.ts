import {
  categoryNameForSlug,
  slugForCategoryName,
} from "../../data/categories";

/** URL-сегмент для карточек без категории */
export const UNCATEGORIZED_SLUG = "uncategorized";

export function categoryToSlug(category: string | undefined): string {
  const c = category?.trim() ?? "";
  if (c === "") return UNCATEGORIZED_SLUG;
  return slugForCategoryName(c) ?? encodeURIComponent(c);
}

export function slugToCategory(slug: string): string {
  const s = decodeURIComponent(slug);
  if (s === UNCATEGORIZED_SLUG) return "";
  const bySlug = categoryNameForSlug(s);
  if (bySlug) return bySlug;
  return s;
}
