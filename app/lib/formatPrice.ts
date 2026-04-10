/** Цена в JSON и API хранится в BYN; для отображения в RUB: BYN × курс. */
export const BYN_TO_RUB = 30;

export type DisplayCurrency = "BYN" | "RUB";

function formatBynAmount(n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function rubFromByn(byn: number): number {
  return Math.round((Number.isFinite(byn) ? byn : 0) * BYN_TO_RUB);
}

/** Одна валюта: «10 BYN» или «300 RUB». */
export function formatCardPrice(
  byn: number,
  currency: DisplayCurrency
): string {
  const safe = Number.isFinite(byn) ? byn : 0;
  if (currency === "BYN") {
    return `${formatBynAmount(safe)} BYN`;
  }
  const rub = rubFromByn(safe);
  return `${rub.toLocaleString("ru-RU")} RUB`;
}
