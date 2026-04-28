import type { OrderStatus } from "@/app/lib/orderTypes";

/** Короткий номер для карточки (например #a1b2c3 для UUID). */
export function formatOrderCardRef(orderId: string): string {
  const id = (orderId || "").trim();
  if (!id) return "—";
  if (/^\d{1,20}$/.test(id)) return id;
  const c = id.replace(/-/g, "");
  if (c.length <= 8) return c;
  return c.slice(-6);
}

const STATUS_RU: Record<OrderStatus, string> = {
  new: "⏳ Новый",
  confirmed: "✅ Принят",
  shipped: "🚚 Отправлен",
  sent: "🚚 Отправлен",
  delivered: "✅ Доставлен",
  cancelled: "❌ Отменён",
};

export function orderStatusLabelRu(status: OrderStatus): string {
  return STATUS_RU[status] ?? `📋 ${status}`;
}

const ALLOWED: readonly OrderStatus[] = [
  "new",
  "confirmed",
  "shipped",
  "sent",
  "delivered",
  "cancelled",
] as const;

/** Распознаёт статус из API/бота. Некорректное значение → null. */
export function parseOrderStatusInput(v: unknown): OrderStatus | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (s === "canceled") return "cancelled";
  if ((ALLOWED as readonly string[]).includes(s)) {
    return s as OrderStatus;
  }
  return null;
}

/** Статус при чтении JSON (неизвестное → new). */
export function orderStatusFromStorage(v: unknown): OrderStatus {
  return parseOrderStatusInput(v) ?? "new";
}

/** Три основных состояния в ЛК + отмена. */
export type OrderAccountUiKind =
  | "processing"
  | "shipped"
  | "completed"
  | "cancelled";

const ACCOUNT_STATUS_LABEL: Record<OrderAccountUiKind, string> = {
  processing: "В обработке",
  shipped: "Отправлен",
  completed: "Завершен",
  cancelled: "Отменён",
};

export function orderAccountUiKind(status: OrderStatus): OrderAccountUiKind {
  switch (status) {
    case "new":
    case "confirmed":
      return "processing";
    case "shipped":
    case "sent":
      return "shipped";
    case "delivered":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return "processing";
  }
}

export function orderAccountStatusLabel(status: OrderStatus): string {
  return ACCOUNT_STATUS_LABEL[orderAccountUiKind(status)];
}

/** Классы бейджа статуса (светлая «плашка» в стиле маркетплейса). */
export function orderAccountBadgeClass(kind: OrderAccountUiKind): string {
  switch (kind) {
    case "processing":
      return "bg-amber-100 text-amber-950 ring-1 ring-amber-300/60";
    case "shipped":
      return "bg-sky-100 text-sky-950 ring-1 ring-sky-300/60";
    case "completed":
      return "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-300/60";
    case "cancelled":
      return "bg-zinc-200 text-zinc-800 ring-1 ring-zinc-400/50";
  }
}
