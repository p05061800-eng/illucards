import type { OrderRecord } from "@/app/lib/orderTypes";

/** Нормализованный @username без @. */
export function normalizeOrderUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/^@/, "");
  return t || null;
}

/** miheevlil или id5879163640 — как в Telegram-боте. */
export function buyerOrderSlug(
  username: string | null | undefined,
  userId: number,
): string {
  const un = normalizeOrderUsername(username);
  if (un) return un.toLowerCase();
  return `id${Math.floor(userId)}`;
}

/** Запасной короткий ref из UUID (если нет buyer_seq). */
export function formatOrderShortRef(orderId: string): string {
  const id = (orderId || "").trim();
  if (!id) return "—";
  if (/^\d{1,20}$/.test(id)) return id;
  const c = id.replace(/-/g, "");
  if (c.length <= 8) return c.toUpperCase();
  return c.slice(-8).toUpperCase();
}

/** Короткое имя заказа: miheevlil1, miheevlil2… */
export function formatOrderDisplayRef(input: {
  orderId: string;
  userId?: number | null;
  username?: string | null;
  buyerSeq?: number | null;
}): string {
  const oid = (input.orderId || "").trim();
  if (!oid) return "—";
  const uid =
    typeof input.userId === "number" &&
    Number.isFinite(input.userId) &&
    input.userId > 0
      ? Math.floor(input.userId)
      : null;
  const seq =
    typeof input.buyerSeq === "number" &&
    Number.isFinite(input.buyerSeq) &&
    input.buyerSeq > 0
      ? Math.floor(input.buyerSeq)
      : 0;
  if (uid != null && seq > 0) {
    return `${buyerOrderSlug(input.username, uid)}${seq}`;
  }
  return formatOrderShortRef(oid);
}

export function formatOrderDisplayLabel(input: {
  orderId: string;
  userId?: number | null;
  username?: string | null;
  buyerSeq?: number | null;
  displayRef?: string | null;
}): string {
  const ref =
    (input.displayRef || "").trim() ||
    formatOrderDisplayRef({
      orderId: input.orderId,
      userId: input.userId,
      username: input.username,
      buyerSeq: input.buyerSeq,
    });
  if (ref === "—") return ref;
  return `Заказ ${ref}`;
}

export function displayRefForRecord(orderId: string, record: OrderRecord): string {
  return formatOrderDisplayRef({
    orderId,
    userId: record.user_id,
    username: record.username,
    buyerSeq: record.buyer_seq,
  });
}
