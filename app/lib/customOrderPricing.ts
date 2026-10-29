import { isCustomOrderCategory } from "@/app/lib/customOrderHeroCarousel";

export { isCustomOrderCategory };

/** Цена одной полноценной карточки на заказ. */
export const CUSTOM_ORDER_PRICE_BYN = 70;
export const CUSTOM_ORDER_PRICE_RUB = 2000;
/** Дополнительная копия того же макета. */
export const CUSTOM_ORDER_COPY_RATE = 0.5;

export function newCartLineKey(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `cl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function cartLineKey(line: { lineKey?: string; id: string }): string {
  const k = line.lineKey?.trim();
  return k || line.id;
}

/** Сколько копий повесить на каждую полноценную карточку (по кругу). */
export function copySlotsForOriginals(
  originals: number,
  copies: number,
): number[] {
  const n = Math.max(0, Math.floor(originals));
  const c = Math.max(0, Math.floor(copies));
  if (n <= 0) return [];
  const slots = Array.from({ length: n }, () => 0);
  for (let i = 0; i < c; i++) slots[i % n] += 1;
  return slots;
}

export function cartLineCopyQuantity(line: {
  copyQuantity?: number;
}): number {
  const n = line.copyQuantity ?? 0;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(99, Math.floor(n));
}

export function isCustomOrderLine(line: {
  category?: string;
  copyQuantity?: number;
}): boolean {
  return isCustomOrderCategory(line.category) || cartLineCopyQuantity(line) > 0;
}

export function cartLinePieceCount(line: {
  quantity: number;
  copyQuantity?: number;
  category?: string;
}): number {
  const orig = Number.isFinite(line.quantity) ? Math.max(0, Math.floor(line.quantity)) : 0;
  if (!isCustomOrderLine(line)) return orig;
  return orig + cartLineCopyQuantity(line);
}

export function cartLineGoodsTotal(line: {
  priceByn: number;
  priceRub: number;
  quantity: number;
  copyQuantity?: number;
  category?: string;
}): { byn: number; rub: number } {
  const orig = Number.isFinite(line.quantity) ? Math.max(0, line.quantity) : 0;
  const copies = isCustomOrderLine(line) ? cartLineCopyQuantity(line) : 0;
  const byn =
    Math.round(
      (line.priceByn * orig + line.priceByn * CUSTOM_ORDER_COPY_RATE * copies) *
        100,
    ) / 100;
  const rub = Math.round(
    line.priceRub * orig + line.priceRub * CUSTOM_ORDER_COPY_RATE * copies,
  );
  return { byn, rub };
}
