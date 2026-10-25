import { categoryNameForSlug, slugForCategoryName } from "@/data/categories";

const TMNT_PARENT_CATEGORY = "TMNT";

/** Стабильный `id` секции каталога для якорей (`#collection-…`). */
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

export function collectionSlugFromName(categoryName: string): string {
  return collectionSectionId(categoryName).replace(/^collection-/, "");
}

export function collectionPath(categoryName: string): string {
  return `/collection/${collectionSlugFromName(categoryName)}`;
}

export function findCategoryNameBySlug(
  slug: string,
  names: readonly string[],
): string | undefined {
  let raw = slug.trim();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* already decoded */
  }
  const s = raw.trim().toLowerCase();
  if (!s) return undefined;

  const fromCanon = categoryNameForSlug(s);
  if (fromCanon) {
    const hit = names.find((n) => n.trim() === fromCanon);
    if (hit) return hit.trim();
  }

  for (const name of names) {
    const n = name.trim();
    if (!n) continue;
    if (collectionSlugFromName(n).toLowerCase() === s) return n;
    if (n.toLowerCase() === s) return n;
  }
  return undefined;
}

export function uniqueCollectionNames(
  tiles: readonly { name: string }[],
  cardCategories: readonly string[] = [],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const n = raw.trim();
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };
  for (const t of tiles) push(t.name);
  for (const c of cardCategories) {
    if (c.trim() === TMNT_PARENT_CATEGORY) {
      push(TMNT_PARENT_CATEGORY);
      continue;
    }
    push(c);
  }
  return out;
}

export function cardBelongsToCollectionName(
  cardCategory: string | undefined,
  collectionName: string,
): boolean {
  const cat = cardCategory?.trim() ?? "";
  const want = collectionName.trim();
  if (!want) return false;
  if (want === TMNT_PARENT_CATEGORY) {
    return cat === TMNT_PARENT_CATEGORY;
  }
  return cat === want;
}
