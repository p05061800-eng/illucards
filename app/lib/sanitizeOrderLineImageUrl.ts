/** Разрешённые URL обложки в позиции заказа (как в корзине). */
export function sanitizeOrderLineImageUrl(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, 2048);
  if (!t) return undefined;
  if (t.startsWith("/") || t.startsWith("http://") || t.startsWith("https://")) {
    return t;
  }
  return undefined;
}
