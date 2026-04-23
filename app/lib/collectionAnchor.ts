import { slugForCategoryName } from "@/data/categories";

/** Стабильный `id` секции каталога для якорей (`#collection-…` на главной). */
export function collectionSectionId(categoryName: string): string {
  const n = categoryName.trim();
  const slug = slugForCategoryName(n);
  if (slug) return `collection-${slug}`;
  const tail = n
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u0400-\u04ff-]/gi, "")
    .replace(/^-|-$/g, "");
  return `collection-${tail || "other"}`;
}
