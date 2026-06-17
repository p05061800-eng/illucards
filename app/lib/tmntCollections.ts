import type { CategoryTile } from "@/app/lib/categoriesJson";
import type { StoredCard } from "@/app/api/cards/route";
import { collectionSectionId } from "@/app/lib/collectionAnchor";

export const TMNT_PARENT_CATEGORY = "TMNT";

/** Две коллекции внутри TMNT на витрине и в админке. */
export const TMNT_COLLECTIONS = [
  { id: "turtles", name: "Черепашки-ниндзя" },
  { id: "foes", name: "Враги и союзники" },
] as const;

export type TmntCollectionId = (typeof TMNT_COLLECTIONS)[number]["id"];

export const TMNT_DEFAULT_COLLECTION_ID: TmntCollectionId = TMNT_COLLECTIONS[0].id;

export function isTmntCategory(category: string | undefined): boolean {
  return (category?.trim() ?? "") === TMNT_PARENT_CATEGORY;
}

export function normalizeTmntCollectionId(
  raw: unknown,
): TmntCollectionId | undefined {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!s) return undefined;
  return TMNT_COLLECTIONS.find((c) => c.id === s)?.id;
}

export function resolveTmntCollectionId(
  raw: string | undefined,
): TmntCollectionId {
  return normalizeTmntCollectionId(raw) ?? TMNT_DEFAULT_COLLECTION_ID;
}

export function tmntCollectionName(id: string | undefined): string {
  const hit = TMNT_COLLECTIONS.find((c) => c.id === id);
  return hit?.name ?? TMNT_COLLECTIONS[0].name;
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

export type CatalogCollectionSection = {
  sectionKey: string;
  heading: string;
  eyebrow?: string;
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
): CatalogCollectionSection[] {
  const seen = new Set<string>();
  const out: CatalogCollectionSection[] = [];

  const pushTile = (tile: CategoryTile) => {
    const name = tile.name.trim();
    if (!name || seen.has(name)) return;
    seen.add(name);

    if (name === TMNT_PARENT_CATEGORY) {
      for (const col of TMNT_COLLECTIONS) {
        out.push({
          sectionKey: `${TMNT_PARENT_CATEGORY}:${col.id}`,
          heading: col.name,
          eyebrow: TMNT_PARENT_CATEGORY,
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

export function adminGroupKeyForCard(card: StoredCard): string {
  if (!isTmntCategory(card.category)) {
    const raw = card.category?.trim();
    return raw && raw.length > 0 ? raw : "Без категории";
  }
  const col = resolveTmntCollectionId(card.subcategory);
  return `${TMNT_PARENT_CATEGORY} · ${tmntCollectionName(col)}`;
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

export function parseSubcategoryForCategory(
  category: string,
  raw: unknown,
): string {
  if (!isTmntCategory(category)) return "";
  return resolveTmntCollectionId(
    typeof raw === "string" ? raw : undefined,
  );
}
