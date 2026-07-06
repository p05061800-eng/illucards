import type { StoredCard } from "@/app/api/cards/route";
export {
  catalogCardFrameClass,
  catalogCardRarityFrameVariant,
  catalogCardRarityGlowClass,
} from "@/app/lib/cardRarityUi";
import {
  cardHasRarityTag,
  cardRequiresAgeConfirmationFromTags,
} from "@/app/lib/cardRarityTags";

/**
 * Размытие / подтверждение возраста только если среди меток редкости есть **18+** (`adult`).
 * Остальные редкости (лимит, новинки и т.д.) сами по себе контент не скрывают.
 */
export function cardRequiresAgeConfirmation(
  card: Pick<StoredCard, "rarity" | "rarities"> | { rarity?: string; rarities?: string[] }
): boolean {
  return cardRequiresAgeConfirmationFromTags(card);
}

export { cardHasRarityTag };
