import { promises as fs } from "fs";
import path from "path";
import { cache } from "react";
import type { StoredCard } from "@/app/api/cards/route";
import { parseCardsJson } from "@/app/lib/cardsJson";
import type { CategoryTile } from "@/app/lib/categoriesJson";
import { parseCategoriesJson } from "@/app/lib/categoriesJson";
import { sortSectionCardsForDefaultCatalog } from "@/app/lib/collectionFilter";
import { resolveTmntCollections } from "@/app/lib/tmntCollections";

const CARDS_PATH = path.join(process.cwd(), "data", "cards.json");
const CATEGORIES_PATH = path.join(process.cwd(), "data", "categories.json");

async function readFileCards(): Promise<StoredCard[]> {
  try {
    const raw = await fs.readFile(CARDS_PATH, "utf-8");
    return parseCardsJson(raw);
  } catch {
    return [];
  }
}

async function readFileCategories(): Promise<CategoryTile[]> {
  try {
    const raw = await fs.readFile(CATEGORIES_PATH, "utf-8");
    return parseCategoriesJson(JSON.parse(raw));
  } catch {
    return [];
  }
}

export type ProductPageData = {
  card: StoredCard;
  categoryCards: StoredCard[];
  categoryNames: string[];
  firstCardIdByCategory: Record<string, string>;
  tmntCollections: ReturnType<typeof resolveTmntCollections>;
};

function bundleFromList(
  card: StoredCard,
  all: StoredCard[],
  categoryTiles: CategoryTile[],
): ProductPageData {
  const cat = card.category?.trim() ?? "";
  const categoryCards =
    cat.length > 0
      ? all.filter((c) => (c.category?.trim() ?? "") === cat)
      : [card];
  const firstCardIdByCategory: Record<string, string> = {};
  const categoryNames = [
    ...new Set(
      all.map((c) => c.category?.trim() ?? "").filter((n) => n.length > 0),
    ),
  ].sort((a, b) => a.localeCompare(b, "ru"));
  for (const name of categoryNames) {
    const inCat = all.filter((c) => (c.category?.trim() ?? "") === name);
    const first = sortSectionCardsForDefaultCatalog(inCat, all)[0];
    if (first) firstCardIdByCategory[name] = first.id;
  }
  return {
    card,
    categoryCards,
    categoryNames,
    firstCardIdByCategory,
    tmntCollections: resolveTmntCollections(categoryTiles),
  };
}

/** Только git-файл: без Redis, чтобы клик не ждал Upstash. Карточки из админки открывает клиент. */
export const loadProductPageData = cache(
  async (id: string): Promise<ProductPageData | null> => {
    const fileCards = await readFileCards();
    const fileHit = fileCards.find((c) => c.id === id);
    if (!fileHit) return null;
    const tiles = await readFileCategories();
    return bundleFromList(fileHit, fileCards, tiles);
  },
);
