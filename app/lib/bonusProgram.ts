import type { DeliveryCountry } from "@/app/lib/delivery";
import { BYN_TO_RUB } from "@/app/lib/formatPrice";

/** Баллы за одну купленную единицу карточки (шт. в заказе). */
export const BONUS_POINTS_PER_CARD_UNIT = 100;

/** 100 баллов = 4 BYN при оплате/списании в режиме доставки BY. */
export const BYN_PER_100_BONUS_POINTS = 4;

/** 100 баллов = 100 RUB при доставке не в BY (списание в рублёвом эквиваленте). */
export const RUB_PER_100_BONUS_POINTS = 100;

/** Скидка в BYN от целого числа баллов (доставка BY). */
export function bonusDiscountBynForByDelivery(bonusPoints: number): number {
  const p = Math.max(0, Math.floor(bonusPoints));
  return Math.round(p * (BYN_PER_100_BONUS_POINTS / BONUS_POINTS_PER_CARD_UNIT) * 100) / 100;
}

/** Скидка в BYN от баллов при доставке не в BY (1 балл = 1 RUB → BYN по курсу каталога). */
export function bonusDiscountBynForRubDelivery(bonusPoints: number): number {
  const p = Math.max(0, Math.floor(bonusPoints));
  const rubOff = p * (RUB_PER_100_BONUS_POINTS / BONUS_POINTS_PER_CARD_UNIT);
  return Math.round((rubOff / BYN_TO_RUB) * 100) / 100;
}

export function bonusDiscountByn(bonusPoints: number, delivery: DeliveryCountry): number {
  return delivery === "BY"
    ? bonusDiscountBynForByDelivery(bonusPoints)
    : bonusDiscountBynForRubDelivery(bonusPoints);
}

/** Максимум баллов, которые можно списать при данном subtotal (BYN) и остатке. */
export function maxSpendableBonusPoints(
  balance: number,
  orderSubtotalByn: number,
  delivery: DeliveryCountry,
): number {
  const b = Math.max(0, Math.floor(balance));
  if (b === 0 || orderSubtotalByn <= 0) return 0;
  let lo = 0;
  let hi = b;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const d = bonusDiscountByn(mid, delivery);
    if (d <= orderSubtotalByn + 0.001) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Сколько баллов начислить за заказ (по количеству карточек). */
export function bonusPointsToEarnForOrderItems(
  items: readonly { quantity: number }[],
): number {
  let qty = 0;
  for (const it of items) {
    qty += Math.max(0, Math.floor(Number(it.quantity) || 0));
  }
  return qty * BONUS_POINTS_PER_CARD_UNIT;
}

/** Текст для ЛК: эквивалент баланса. */
export function bonusBalanceDescriptionRu(balance: number): string {
  const p = Math.max(0, Math.floor(balance));
  if (p <= 0) return "0 баллов";
  const byn = (p / BONUS_POINTS_PER_CARD_UNIT) * BYN_PER_100_BONUS_POINTS;
  const rub = (p / BONUS_POINTS_PER_CARD_UNIT) * RUB_PER_100_BONUS_POINTS;
  return `${p.toLocaleString("ru-RU")} — при списании ≈ ${byn.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} BYN или ${rub.toLocaleString("ru-RU")} RUB`;
}
