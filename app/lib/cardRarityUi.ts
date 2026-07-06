import type { StoredCard } from "../api/cards/route";
import type { CardRarity } from "./cardRarityTags";
import { cardHasRarityTag, type CardRaritySource } from "./cardRarityTags";

export const RARITY_STYLES: Record<CardRarity, string> = {
  common: "text-zinc-400",
  limited: "text-amber-200",
  adult: "text-rose-300",
  replica: "text-sky-300",
  novelty: "text-emerald-300",
  hot_price: "text-fuchsia-300",
};

/** @deprecated Используйте `catalogCardRarityGlowClass`. */
export const RARITY_GLOW: Record<CardRarity, string> = {
  common: "",
  limited: "",
  adult: "",
  replica: "",
  novelty: "",
  hot_price: "",
};

export type CatalogCardRarityFrameVariant =
  | "none"
  | "limited"
  | "adult"
  | "limited_adult"
  | "hot_price";

export function catalogCardRarityFrameVariant(
  card: CardRaritySource,
): CatalogCardRarityFrameVariant {
  const isAdult = cardHasRarityTag(card, "adult");
  const isLimited = cardHasRarityTag(card, "limited");

  if (isAdult && isLimited) return "limited_adult";
  if (isAdult) return "adult";
  if (isLimited) return "limited";
  if (cardHasRarityTag(card, "hot_price")) return "hot_price";
  return "none";
}

/** Подсветка сзади карточки: золото (лимит), красное (18+), оба, горячая цена. */
export function catalogCardRarityGlowClass(card: CardRaritySource): string {
  switch (catalogCardRarityFrameVariant(card)) {
    case "limited":
      return "card-rarity-glow card-rarity-glow--limited";
    case "adult":
      return "card-rarity-glow card-rarity-glow--adult";
    case "limited_adult":
      return "card-rarity-glow card-rarity-glow--limited-adult";
    case "hot_price":
      return "card-rarity-glow card-rarity-glow--hot-price";
    default:
      return "";
  }
}

/** @deprecated Используйте `catalogCardRarityGlowClass`. */
export function catalogCardFrameClass(
  card: Pick<StoredCard, "rarity" | "rarities" | "noveltySince" | "frontImage">,
): string {
  return catalogCardRarityGlowClass(card);
}

/** @deprecated Используйте `catalogCardRarityGlowClass`. */
export function catalogCardRarityShellClass(
  card: CardRaritySource,
): string | null {
  void card;
  return null;
}
