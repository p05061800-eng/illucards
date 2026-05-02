import { normalizeDeliveryCountry, type DeliveryCountry } from "@/app/lib/delivery";
import { cardTreatsAsAdultPricing } from "@/app/lib/cardRarityTags";

/** Если в карточке не задан свой рубль — BYN × курс. */
export const BYN_TO_RUB = 30;

export type DisplayCurrency = "BYN" | "RUB";

export function currencyByCountry(
  country: DeliveryCountry | string | null | undefined,
): DisplayCurrency {
  const normalized = normalizeDeliveryCountry(country);
  if (normalized === "RU" || normalized === "UA" || normalized === "OTHER") return "RUB";
  return "BYN";
}

/** Цены в корзине / чекауте / ЛК: RUB при доставке не в BY. */
export function displayCurrencyForDelivery(
  country: DeliveryCountry | string | null | undefined,
): DisplayCurrency {
  return currencyByCountry(country);
}

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
  rarities?: readonly string[] | undefined;
  price?: number;
  priceByn?: number;
  priceRub?: number | null;
};

export function effectiveCardPriceByn(card: CardPriceFields): number {
  if (cardTreatsAsAdultPricing(card)) return ADULT_FIXED_PRICE_BYN;
  if (card.priceByn != null && Number.isFinite(card.priceByn)) return card.priceByn;
  return card.price != null && Number.isFinite(card.price) ? card.price : 0;
}

export function effectiveCardPriceRub(card: CardPriceFields): number {
  if (cardTreatsAsAdultPricing(card)) return ADULT_FIXED_PRICE_RUB;
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

export function productPriceByCountry(
  product: { priceByn?: number; priceRub?: number | null; price?: number },
  country: DeliveryCountry | string | null | undefined,
): number {
  const byn =
    product.priceByn != null && Number.isFinite(product.priceByn)
      ? product.priceByn
      : Number.isFinite(product.price)
        ? (product.price as number)
        : 0;
  const rub =
    product.priceRub != null && Number.isFinite(product.priceRub)
      ? Math.round(product.priceRub)
      : rubFromByn(byn);
  return currencyByCountry(country) === "BYN" ? byn : rub;
}

/** Итог заказа в ЛК: BYN для доставки по BY, иначе сумма в RUB (как на витрине). */
export function formatOrderTotalForDisplay(
  totalByn: number,
  delivery: DeliveryCountry | null | undefined,
): string {
  const safe = Number.isFinite(totalByn) ? totalByn : 0;
  const d = delivery ?? "BY";
  if (d === "BY") {
    return `${formatBynAmount(safe)} BYN`;
  }
  return formatCardPrice(safe, "RUB");
}
