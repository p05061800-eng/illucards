import { BYN_TO_RUB, rubFromByn } from "./formatPrice";

/** Страна доставки (до оформления заказа). */
export type DeliveryCountry = "BY" | "RU" | "UA" | "OTHER";

export const DELIVERY_COUNTRY_LABELS: Record<DeliveryCountry, string> = {
  BY: "Беларусь",
  RU: "Россия",
  UA: "Украина",
  OTHER: "Другие страны",
};

export const DELIVERY_COUNTRY_OPTIONS: readonly {
  id: DeliveryCountry;
  label: string;
}[] = [
  { id: "BY", label: DELIVERY_COUNTRY_LABELS.BY },
  { id: "RU", label: DELIVERY_COUNTRY_LABELS.RU },
  { id: "UA", label: DELIVERY_COUNTRY_LABELS.UA },
  { id: "OTHER", label: DELIVERY_COUNTRY_LABELS.OTHER },
];

/** Фиксированная стоимость доставки: BYN или RUB по правилам магазина. */
export function deliveryCharge(
  country: DeliveryCountry,
): { amountByn: number; amountRub: number } {
  switch (country) {
    case "BY":
      return { amountByn: 6, amountRub: rubFromByn(6) };
    case "RU":
      return {
        amountByn: Math.round((600 / BYN_TO_RUB) * 100) / 100,
        amountRub: 600,
      };
    case "UA":
      return {
        amountByn: Math.round((3000 / BYN_TO_RUB) * 100) / 100,
        amountRub: 3000,
      };
    case "OTHER":
      return {
        amountByn: Math.round((800 / BYN_TO_RUB) * 100) / 100,
        amountRub: 800,
      };
  }
}

/** Строка «Доставка: …» для текста в Telegram (валюта как в тарифе). */
export function formatDeliveryLineTelegram(country: DeliveryCountry): string {
  const label = DELIVERY_COUNTRY_LABELS[country];
  const { amountByn, amountRub } = deliveryCharge(country);
  if (country === "BY") {
    return `Доставка: ${label} — ${amountByn} BYN`;
  }
  return `Доставка: ${label} — ${amountRub.toLocaleString("ru-RU")} RUB`;
}
