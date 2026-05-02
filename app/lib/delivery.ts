import { BYN_TO_RUB, rubFromByn } from "./formatPrice";

/** Страна доставки (до оформления заказа). */
export type DeliveryCountry = "BY" | "RU" | "UA" | "OTHER";

/** Нормализация страны доставки из localStorage/API/legacy значений. */
export function normalizeDeliveryCountry(raw: unknown): DeliveryCountry | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  const upper = value.toUpperCase();
  if (upper === "BY" || upper === "RU" || upper === "UA" || upper === "OTHER") {
    return upper;
  }
  if (upper === "BELARUS" || upper === "BELARUSI" || upper === "БЕЛАРУСЬ") return "BY";
  if (upper === "RUSSIA" || upper === "РОССИЯ") return "RU";
  if (upper === "UKRAINE" || upper === "УКРАИНА") return "UA";
  if (
    upper === "OTHER_COUNTRIES" ||
    upper === "OTHERS" ||
    upper === "ДРУГИЕ СТРАНЫ" ||
    upper === "ДРУГИЕ"
  ) {
    return "OTHER";
  }
  return null;
}

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
