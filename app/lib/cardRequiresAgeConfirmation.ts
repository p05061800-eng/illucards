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
