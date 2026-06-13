export type OrderPaymentMethod = "card" | "crypto" | "phone";

const LABELS: Record<OrderPaymentMethod, string> = {
  card: "💳 Карта",
  crypto: "₿ Крипта",
  phone: "💵 Перевод",
};

export function orderPaymentMethodLabel(method: OrderPaymentMethod): string {
  return LABELS[method];
}

export function parseOrderPaymentMethod(v: unknown): OrderPaymentMethod | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (s === "card" || s === "crypto" || s === "phone") return s;
  return null;
}
