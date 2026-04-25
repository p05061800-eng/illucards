import type { StoredCard } from "@/app/api/cards/route";

/**
 * Карточки с размытием до подтверждения «Мне есть 18 лет»:
 * редкость adult и доп. позиции по категории + порядку в коллекции.
 */
export function cardRequiresAgeConfirmation(card: {
  rarity?: string;
  category?: string;
  categoryOrder?: number;
}): boolean {
  if (card.rarity === "adult") return true;
  const cat = (card.category ?? "").trim();
  const order = card.categoryOrder;
  if (typeof order !== "number" || !Number.isFinite(order)) return false;
  if (cat === "TMNT" && (order === 10 || order === 20)) return true;
  if (cat === "Marvel" && order === 8) return true;
  return false;
}

/** Рамка превью: 18+ — красная; иначе лимитированная — золотая. */
export function catalogCardFrameClass(card: StoredCard): string {
  if (cardRequiresAgeConfirmation(card)) {
    return "ring-1 ring-inset ring-rose-500/75";
  }
  if (card.rarity === "limited") {
    return "ring-1 ring-inset ring-amber-400/55";
  }
  return "";
}
