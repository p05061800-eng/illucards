import type { StoredCard } from "@/app/api/cards/route";
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

/** Рамка превью: 18+ — красная; иначе лимитированная — золотая. */
export function catalogCardFrameClass(card: StoredCard): string {
  if (cardRequiresAgeConfirmation(card)) {
    return "ring-1 ring-inset ring-rose-500/75";
  }
  if (cardHasRarityTag(card, "limited")) {
    return "ring-1 ring-inset ring-amber-400/55";
  }
  return "";
}
