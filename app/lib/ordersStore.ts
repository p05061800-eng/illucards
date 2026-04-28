import { promises as fs } from "fs";
import path from "path";
import { orderStatusFromStorage } from "@/app/lib/orderStatus";
import { ORDERS_DIR } from "@/app/lib/orderPaths";
import type { OrderLineIn, OrderRecord, OrderStatus } from "@/app/lib/orderTypes";

/**
 * In-memory заказы (сервер). При перезапуске подгружается из `data/orders/*.json`.
 */
export const ORDERS: Record<string, OrderRecord> = Object.create(null);

export function registerOrder(orderId: string, record: OrderRecord): void {
  ORDERS[orderId] = record;
}

function parseItemsLoose(raw: unknown): OrderLineIn[] | null {
  if (!Array.isArray(raw)) return null;
  const out: OrderLineIn[] = [];
  for (const row of raw) {
    if (typeof row !== "object" || row === null) return null;
    const o = row as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.title !== "string") return null;
    out.push({
      id: o.id,
      title: o.title,
      quantity: Number(o.quantity),
      priceByn: Number(o.priceByn),
      priceRub: Number(o.priceRub),
    });
  }
  return out;
}

function fileToOrderRecord(raw: unknown): OrderRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const items = parseItemsLoose(o.items);
  if (!items) return null;

  const dRaw = o.delivery ?? o.deliveryCountry;
  const delivery =
    dRaw === "BY" || dRaw === "RU" || dRaw === "UA" || dRaw === "OTHER"
      ? dRaw
      : null;
  if (!delivery) return null;

  let total: number;
  if (typeof o.total === "number" && Number.isFinite(o.total)) {
    total = o.total;
  } else if (
    o.totals &&
    typeof o.totals === "object" &&
    o.totals !== null
  ) {
    const t = o.totals as Record<string, unknown>;
    const ob = t.orderByn;
    total = typeof ob === "number" ? ob : Number(ob);
  } else {
    return null;
  }
  if (!Number.isFinite(total)) return null;

  const userIdRaw = o.user_id;
  const user_id =
    typeof userIdRaw === "number"
      ? userIdRaw
      : userIdRaw != null
        ? Number(userIdRaw)
        : undefined;
  const username: string | null =
    typeof o.username === "string" ? o.username.replace(/^@/, "").trim() || null : null;

  return {
    ...(user_id != null && Number.isFinite(user_id) && user_id > 0
      ? { user_id: Math.floor(user_id) }
      : {}),
    username,
    items,
    total,
    delivery,
    status: orderStatusFromStorage(o.status),
  };
}

/** Вернуть заказ: сначала память, иначе файл. */
export async function getOrder(orderId: string): Promise<OrderRecord | null> {
  if (!orderId || typeof orderId !== "string") return null;
  if (orderId.length > 200 || /[/\\]/.test(orderId) || orderId.includes("..")) {
    return null;
  }
  const id = orderId.trim();
  if (!id) return null;

  const cached = ORDERS[id];
  if (cached) return cached;

  const filePath = path.join(ORDERS_DIR, `${id}.json`);
  try {
    const text = await fs.readFile(filePath, "utf-8");
    const json = JSON.parse(text) as unknown;
    const record = fileToOrderRecord(json);
    if (!record) return null;
    ORDERS[id] = record;
    return record;
  } catch {
    return null;
  }
}

function sanitizeOrderIdForPath(orderId: string): string | null {
  if (!orderId || typeof orderId !== "string") return null;
  if (orderId.length > 200 || /[/\\]/.test(orderId) || orderId.includes("..")) {
    return null;
  }
  const id = orderId.trim();
  return id || null;
}

/**
 * Обновить статус заказа в JSON и в памяти ORDERS.
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const id = sanitizeOrderIdForPath(orderId);
  if (!id) {
    return { ok: false, error: "Некорректный order_id", status: 400 };
  }

  const existing = await getOrder(id);
  if (!existing) {
    return { ok: false, error: "Заказ не найден", status: 404 };
  }

  const filePath = path.join(ORDERS_DIR, `${id}.json`);
  let raw: Record<string, unknown>;
  try {
    const text = await fs.readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) {
      return { ok: false, error: "Некорректные данные заказа", status: 500 };
    }
    raw = parsed as Record<string, unknown>;
  } catch {
    return { ok: false, error: "Не удалось прочитать заказ", status: 500 };
  }

  raw.status = status;

  try {
    await fs.writeFile(filePath, JSON.stringify(raw, null, 2), "utf-8");
  } catch {
    return { ok: false, error: "Не удалось сохранить заказ", status: 500 };
  }

  const record = fileToOrderRecord(raw);
  if (!record) {
    return { ok: false, error: "Некорректные данные заказа", status: 500 };
  }
  ORDERS[id] = record;
  return { ok: true };
}

export type OrderListSummary = {
  id: string;
  total: number;
  status: OrderStatus;
};

/**
 * Заказы с диска, у которых user_id совпадает (новые — по mtime).
 */
export async function listOrdersForUser(
  userId: number,
): Promise<OrderListSummary[]> {
  if (!Number.isFinite(userId) || userId <= 0) return [];
  const uid = Math.floor(userId);
  let files: string[] = [];
  try {
    files = await fs.readdir(ORDERS_DIR);
  } catch {
    return [];
  }
  const rows: Array<OrderListSummary & { mtime: number }> = [];
  for (const f of files) {
    if (!f.toLowerCase().endsWith(".json")) continue;
    const id = f.replace(/\.json$/i, "");
    if (!id || id.length > 200 || /[/\\]/.test(id) || id.includes("..")) continue;
    const record = await getOrder(id);
    if (!record || record.user_id !== uid) continue;
    let mtime = 0;
    try {
      const st = await fs.stat(path.join(ORDERS_DIR, f));
      mtime = st.mtimeMs;
    } catch {
      /* ignore */
    }
    rows.push({
      id,
      total: record.total,
      status: record.status,
      mtime,
    });
  }
  rows.sort((a, b) => b.mtime - a.mtime);
  return rows.map(({ mtime: _m, ...rest }) => rest);
}
