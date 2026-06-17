import type { CategoryTile } from "@/app/lib/categoriesJson";
import type { StoredCard } from "@/app/api/cards/route";
import { collectionSectionId } from "@/app/lib/collectionAnchor";

export const TMNT_PARENT_CATEGORY = "TMNT";

export const TMNT_COLLECTION_IDS = ["turtles", "foes"] as const;

export type TmntCollectionId = (typeof TMNT_COLLECTION_IDS)[number];

export type TmntCollectionDef = {
  id: TmntCollectionId;
  name: string;
};

/** Значения по умолчанию, если в `categories.json` у TMNT нет `tmntSubcollections`. */
export const DEFAULT_TMNT_COLLECTIONS: readonly TmntCollectionDef[] = [
  { id: "turtles", name: "Последний урок" },
  { id: "foes", name: "Наследие Хамато" },
] as const;

/** @deprecated Используйте `resolveTmntCollections(categoryTiles)`. */
export const TMNT_COLLECTIONS = DEFAULT_TMNT_COLLECTIONS;

export const TMNT_DEFAULT_COLLECTION_ID: TmntCollectionId =
  DEFAULT_TMNT_COLLECTIONS[0].id;

export function isTmntCategory(category: string | undefined): boolean {
  return (category?.trim() ?? "") === TMNT_PARENT_CATEGORY;
}

export function normalizeTmntCollectionId(
  raw: unknown,
): TmntCollectionId | undefined {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!s) return undefined;
  return TMNT_COLLECTION_IDS.find((id) => id === s);
}

export function resolveTmntCollectionId(
  raw: string | undefined,
): TmntCollectionId {
  return normalizeTmntCollectionId(raw) ?? TMNT_DEFAULT_COLLECTION_ID;
}

/** Названия подколлекций TMNT из вкладки «Категории» (`tmntSubcollections`). */
export function resolveTmntCollections(
  categoryTiles?: readonly CategoryTile[],
): TmntCollectionDef[] {
  const tmntTile = categoryTiles?.find(
    (t) => t.name.trim() === TMNT_PARENT_CATEGORY,
  );
  const raw = tmntTile?.tmntSubcollections;
  if (!raw?.length) {
    return DEFAULT_TMNT_COLLECTIONS.map((c) => ({ ...c }));
  }

  const names = new Map<TmntCollectionId, string>(
    DEFAULT_TMNT_COLLECTIONS.map((c) => [c.id, c.name]),
  );
  for (const row of raw) {
    const id = normalizeTmntCollectionId(row.id);
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (id && name) names.set(id, name);
  }

  return DEFAULT_TMNT_COLLECTIONS.map((c) => ({
    id: c.id,
    name: names.get(c.id) ?? c.name,
  }));
}

export function tmntCollectionName(
  id: string | undefined,
  collections: readonly TmntCollectionDef[] = DEFAULT_TMNT_COLLECTIONS,
): string {
  const want = resolveTmntCollectionId(id);
  return (
    collections.find((c) => c.id === want)?.name ??
    collections[0]?.name ??
    DEFAULT_TMNT_COLLECTIONS[0].name
  );
}

export function tmntCollectionSectionId(collectionId: string): string {
  return `collection-tmnt-${resolveTmntCollectionId(collectionId)}`;
}

export function catalogSectionIdForCard(
  card: Pick<StoredCard, "category" | "subcategory">,
): string {
  if (!isTmntCategory(card.category)) {
    const name = card.category?.trim() ?? "";
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\u0400-\u04ff-]/gi, "")
      .replace(/^-|-$/g, "");
    return `collection-${slug || "other"}`;
  }
  return tmntCollectionSectionId(resolveTmntCollectionId(card.subcategory));
}

export type CatalogSectionTitleMode = "banner" | "text";

export type CatalogCollectionSection = {
  sectionKey: string;
  heading: string;
  eyebrow?: string;
  /** TMNT-подколлекции — текстовый заголовок; плашка родителя — один раз на блок TMNT. */
  titleMode: CatalogSectionTitleMode;
  parentCategory: string;
  tmntCollectionId?: TmntCollectionId;
  banner: CategoryTile;
};

export function cardBelongsToCatalogSection(
  card: StoredCard,
  section: CatalogCollectionSection,
): boolean {
  const cat = card.category?.trim() ?? "";
  if (cat !== section.parentCategory) return false;
  if (section.tmntCollectionId) {
    return resolveTmntCollectionId(card.subcategory) === section.tmntCollectionId;
  }
  return true;
}

/** Разворачивает TMNT в две строки коллекций на главной. */
export function buildCatalogCollectionSections(
  categoryTiles: readonly CategoryTile[],
  orphanCategoryNames: readonly string[],
  tmntCollections: readonly TmntCollectionDef[] = resolveTmntCollections(
    categoryTiles,
  ),
): CatalogCollectionSection[] {
  const seen = new Set<string>();
  const out: CatalogCollectionSection[] = [];

  const pushTile = (tile: CategoryTile) => {
    const name = tile.name.trim();
    if (!name || seen.has(name)) return;
    seen.add(name);

    if (name === TMNT_PARENT_CATEGORY) {
      for (const col of tmntCollections) {
        out.push({
          sectionKey: `${TMNT_PARENT_CATEGORY}:${col.id}`,
          heading: col.name,
          titleMode: "text",
          parentCategory: TMNT_PARENT_CATEGORY,
          tmntCollectionId: col.id,
          banner: tile,
        });
      }
      return;
    }

    out.push({
      sectionKey: name,
      heading: name,
      titleMode: "banner",
      parentCategory: name,
      banner: tile,
    });
  };

  for (const tile of categoryTiles) {
    pushTile(tile);
  }

  for (const name of orphanCategoryNames) {
    if (seen.has(name)) continue;
    if (name === TMNT_PARENT_CATEGORY) {
      pushTile({ name, image: "" });
      continue;
    }
    out.push({
      sectionKey: name,
      heading: name,
      titleMode: "banner",
      parentCategory: name,
      banner: { name, image: "" },
    });
    seen.add(name);
  }

  return out;
}

export function maxCategoryOrderInTmntCollection(
  cards: readonly StoredCard[],
  collectionId: string,
): number {
  const want = resolveTmntCollectionId(collectionId);
  let max = 0;
  for (const c of cards) {
    if (!isTmntCategory(c.category)) continue;
    if (resolveTmntCollectionId(c.subcategory) !== want) continue;
    const o = c.categoryOrder;
    if (o != null && o > max) max = o;
  }
  return max;
}

export function adminGroupKeyForCard(
  card: StoredCard,
  collections: readonly TmntCollectionDef[] = DEFAULT_TMNT_COLLECTIONS,
): string {
  if (!isTmntCategory(card.category)) {
    const raw = card.category?.trim();
    return raw && raw.length > 0 ? raw : "Без категории";
  }
  const col = resolveTmntCollectionId(card.subcategory);
  return `${TMNT_PARENT_CATEGORY} · ${tmntCollectionName(col, collections)}`;
}

export function findCatalogSectionForCard(
  card: StoredCard,
  sections: readonly CatalogCollectionSection[],
): CatalogCollectionSection | undefined {
  return sections.find((s) => cardBelongsToCatalogSection(card, s));
}

export function catalogSectionDomId(section: CatalogCollectionSection): string {
  if (section.tmntCollectionId) {
    return tmntCollectionSectionId(section.tmntCollectionId);
  }
  return collectionSectionId(section.parentCategory);
}

/** Якорь общей плашки TMNT на витрине (`#collection-tmnt`). */
export function tmntParentBannerDomId(): string {
  return collectionSectionId(TMNT_PARENT_CATEGORY);
}

export function parseSubcategoryForCategory(
  category: string,
  raw: unknown,
): string {
  if (!isTmntCategory(category)) return "";
  return resolveTmntCollectionId(
    typeof raw === "string" ? raw : undefined,
  );
}

/** Подколлекции TMNT для редактора категорий (всегда две строки с id). */
export function defaultTmntSubcollectionsForEditor(): TmntCollectionDef[] {
  return DEFAULT_TMNT_COLLECTIONS.map((c) => ({ ...c }));
}

export function ensureTmntSubcollectionsOnTile(
  tile: CategoryTile,
): CategoryTile {
  if (tile.name.trim() !== TMNT_PARENT_CATEGORY) return tile;
  const subs = tile.tmntSubcollections?.length
    ? tile.tmntSubcollections
    : defaultTmntSubcollectionsForEditor();
  return { ...tile, tmntSubcollections: subs.map((c) => ({ ...c })) };
}
