import type { DeliveryCountry } from "@/app/lib/delivery";
import {
  DELIVERY_COUNTRY_LABELS,
  deliveryCharge,
} from "@/app/lib/delivery";
import { displayCurrencyForDelivery } from "@/app/lib/formatPrice";
import type { OrderLineIn } from "@/app/lib/orderTypes";

export const DELIVERY_FLAGS: Record<DeliveryCountry, string> = {
  BY: "🇧🇾",
  RU: "🇷🇺",
  UA: "🇺🇦",
  OTHER: "🌍",
};

function formatBynAmount(n: number): string {
  const x = Number.isFinite(n) ? n : 0;
  return `${(Math.round(x * 100) / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} BYN`;
}

function formatRubAmount(n: number): string {
  const x = Number.isFinite(n) ? Math.round(n) : 0;
  return `${x.toLocaleString("ru-RU")} RUB`;
}

/** Сумма товаров в RUB (как в корзине). */
export function orderGoodsTotalRub(items: readonly OrderLineIn[]): number {
  return items.reduce(
    (s, l) => s + Math.round(l.priceRub) * Math.max(1, Math.floor(l.quantity)),
    0,
  );
}

/** Итого к оплате в валюте витрины. */
export function orderCheckoutDisplayTotal(input: {
  items: readonly OrderLineIn[];
  delivery: DeliveryCountry;
  totalByn: number;
}): { amount: number; currency: "BYN" | "RUB" } {
  if (displayCurrencyForDelivery(input.delivery) === "BYN") {
    return { amount: input.totalByn, currency: "BYN" };
  }
  const goodsRub = orderGoodsTotalRub(input.items);
  const delRub = deliveryCharge(input.delivery).amountRub;
  return {
    amount: Math.max(0, goodsRub + delRub),
    currency: "RUB",
  };
}

export function formatOrderLineTelegram(
  item: OrderLineIn,
  delivery: DeliveryCountry,
): string {
  const qty = Math.max(1, Math.floor(item.quantity));
  const title = item.title.trim() || "—";
  if (displayCurrencyForDelivery(delivery) === "BYN") {
    const unit = item.priceByn;
    const sub = unit * qty;
    return `• ${title} — ${qty} шт. × ${formatBynAmount(unit)} = ${formatBynAmount(sub)}`;
  }
  const unitRub = Math.round(item.priceRub);
  const subRub = unitRub * qty;
  return `• ${title} — ${qty} шт. × ${unitRub.toLocaleString("ru-RU")} RUB = ${subRub.toLocaleString("ru-RU")} RUB`;
}

export function formatDeliveryLineTelegram(delivery: DeliveryCountry): string {
  const flag = DELIVERY_FLAGS[delivery] ?? "🌍";
  const label = DELIVERY_COUNTRY_LABELS[delivery];
  const { amountByn, amountRub } = deliveryCharge(delivery);
  if (delivery === "BY") {
    return `🚚 Доставка: ${flag} ${label} — ${formatBynAmount(amountByn)}`;
  }
  return `🚚 Доставка: ${flag} ${label} — ${formatRubAmount(amountRub)}`;
}

export function formatOrderTotalTelegram(input: {
  items: readonly OrderLineIn[];
  delivery: DeliveryCountry;
  totalByn: number;
}): string {
  const { amount, currency } = orderCheckoutDisplayTotal(input);
  return currency === "BYN" ? formatBynAmount(amount) : formatRubAmount(amount);
}
