import type { StoredCard } from "../api/cards/route";
import { cardHasRarityTag } from "@/app/lib/cardRarityTags";
import {
  type CategoryFilterId,
  cardMatchesCategorySlug,
  CATEGORY_FILTER_IDS,
  categoryFilterLabel,
} from "../../data/categories";

export type MarketplaceCatalogFilter =
  | "all"
  | "new"
  | "popular"
  | "sale"
  | "common"
  | "limited"
  | "adult"
  | "replica"
  | "novelty"
  | "hot_price";

export {
  CATEGORY_FILTER_IDS,
  type CategoryFilterId,
  categoryFilterLabel,
};

/** Совпадение карточки с выбранным фильтром категории */
export function cardMatchesCategoryFilter(
  card: StoredCard,
  filterId: CategoryFilterId
): boolean {
  return cardMatchesCategorySlug(card.category ?? "", filterId);
}

function matchesCatalogFilter(
  card: StoredCard,
  filter: MarketplaceCatalogFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "new") return card.isNew === true;
  if (filter === "popular") return card.isPopular === true;
  if (filter === "sale") return card.isSale === true;
  if (filter === "common") return cardHasRarityTag(card, "common");
  if (filter === "limited") return cardHasRarityTag(card, "limited");
  if (filter === "adult") return cardHasRarityTag(card, "adult");
  if (filter === "replica") return cardHasRarityTag(card, "replica");
  if (filter === "novelty") return cardHasRarityTag(card, "novelty");
  if (filter === "hot_price") return cardHasRarityTag(card, "hot_price");
  return false;
}

export function filterMarketplaceCards(
  cards: StoredCard[],
  selectedCategory: CategoryFilterId,
  catalogFilter: MarketplaceCatalogFilter
): StoredCard[] {
  return cards.filter((card) => {
    if (!cardMatchesCategoryFilter(card, selectedCategory)) return false;
    return matchesCatalogFilter(card, catalogFilter);
  });
}
