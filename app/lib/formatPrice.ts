/** Если в карточке не задан свой рубль — BYN × курс. */
export const BYN_TO_RUB = 30;

export type DisplayCurrency = "BYN" | "RUB";

function formatBynAmount(n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function rubFromByn(byn: number): number {
  return Math.round((Number.isFinite(byn) ? byn : 0) * BYN_TO_RUB);
}

/**
 * Цена товара: `byn` всегда в бел. рублях; для RUB — свой `rubOverride` из админки
 * или автоконверсия по курсу.
 */
export function formatCardPrice(
  byn: number,
  currency: DisplayCurrency,
  rubOverride?: number | null
): string {
  const safe = Number.isFinite(byn) ? byn : 0;
  if (currency === "BYN") {
    return `${formatBynAmount(safe)} BYN`;
  }
  const rub =
    rubOverride != null && Number.isFinite(rubOverride)
      ? Math.round(rubOverride)
      : rubFromByn(safe);
  return `${rub.toLocaleString("ru-RU")} RUB`;
}

/** Для `rarity: "adult"` — фиксированная розница (независимо от полей в JSON). */
export const ADULT_FIXED_PRICE_BYN = 30;
export const ADULT_FIXED_PRICE_RUB = 800;

export type CardPriceFields = {
  rarity?: string | undefined;
  price: number;
  priceRub?: number | null;
};

export function effectiveCardPriceByn(card: CardPriceFields): number {
  if (card.rarity === "adult") return ADULT_FIXED_PRICE_BYN;
  return Number.isFinite(card.price) ? card.price : 0;
}

export function effectiveCardPriceRub(card: CardPriceFields): number {
  if (card.rarity === "adult") return ADULT_FIXED_PRICE_RUB;
  const byn = effectiveCardPriceByn(card);
  if (card.priceRub != null && Number.isFinite(card.priceRub)) {
    return Math.round(card.priceRub);
  }
  return rubFromByn(byn);
}

export function formatStoredCardPrice(
  card: CardPriceFields,
  currency: DisplayCurrency
): string {
  return formatCardPrice(
    effectiveCardPriceByn(card),
    currency,
    effectiveCardPriceRub(card)
  );
}
