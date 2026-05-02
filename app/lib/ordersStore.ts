import { promises as fs } from "fs";
import path from "path";
import { parseCardsJson } from "@/app/lib/cardsJson";
import { parseCardRarity, type CardRarity } from "@/app/lib/cardRarityTags";
import { normalizeDeliveryCountry, type DeliveryCountry } from "@/app/lib/delivery";
import { orderStatusFromStorage } from "@/app/lib/orderStatus";
import { ORDERS_DIR } from "@/app/lib/orderPaths";
import type { OrderLineIn, OrderRecord, OrderStatus } from "@/app/lib/orderTypes";
import { sanitizeOrderLineImageUrl } from "@/app/lib/sanitizeOrderLineImageUrl";

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
    const line: OrderLineIn = {
      id: o.id,
      title: o.title,
      quantity: Number(o.quantity),
      priceByn: Number(o.priceByn),
      priceRub: Number(o.priceRub),
    };
    const img = sanitizeOrderLineImageUrl(o.frontImage);
    if (img) line.frontImage = img;
    const catRaw = o.category;
    if (typeof catRaw === "string") {
      const cat = catRaw.trim().slice(0, 120);
      if (cat) line.category = cat;
    }
    if (typeof o.rarity === "string" && o.rarity.trim()) {
      line.rarity = parseCardRarity(o.rarity);
    }
    out.push(line);
  }
  return out;
}

function fileToOrderRecord(raw: unknown): OrderRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const items = parseItemsLoose(o.items);
  if (!items) return null;

  const dRaw = o.delivery ?? o.deliveryCountry;
  const delivery = normalizeDeliveryCountry(dRaw);
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

  const adminMidRaw = o.telegram_admin_message_id;
  const telegram_admin_message_id =
    typeof adminMidRaw === "number" && Number.isFinite(adminMidRaw) && adminMidRaw > 0
      ? Math.floor(adminMidRaw)
      : undefined;

  return {
    ...(user_id != null && Number.isFinite(user_id) && user_id > 0
      ? { user_id: Math.floor(user_id) }
      : {}),
    username,
    items,
    total,
    delivery,
    status: orderStatusFromStorage(o.status),
    ...(telegram_admin_message_id != null
      ? { telegram_admin_message_id }
      : {}),
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
  if (cached) {
    await enrichOrderRecordItemsIfNeeded(cached);
    return cached;
  }

  const filePath = path.join(ORDERS_DIR, `${id}.json`);
  try {
    const text = await fs.readFile(filePath, "utf-8");
    const json = JSON.parse(text) as unknown;
    const record = fileToOrderRecord(json);
    if (!record) return null;
    await enrichOrderRecordItemsIfNeeded(record);
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
 * Обновить статус заказа в памяти ORDERS и по возможности в `data/orders/*.json`.
 * На serverless без записи на диск остаётся хотя бы in-memory (до рестарта).
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

  const updated: OrderRecord = { ...existing, status };
  ORDERS[id] = updated;

  const filePath = path.join(ORDERS_DIR, `${id}.json`);
  try {
    const text = await fs.readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) {
      return { ok: true };
    }
    const raw = parsed as Record<string, unknown>;
    raw.status = status;
    if (updated.telegram_admin_message_id != null) {
      raw.telegram_admin_message_id = updated.telegram_admin_message_id;
    }
    await fs.writeFile(filePath, JSON.stringify(raw, null, 2), "utf-8");
  } catch {
    /* нет файла или FS только для чтения — статус уже в ORDERS */
  }

  return { ok: true };
}

/** Бот сообщает message_id уведомления админу (после sendMessage). */
export async function setOrderTelegramAdminMessageId(
  orderId: string,
  messageId: number,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const id = sanitizeOrderIdForPath(orderId);
  if (!id) {
    return { ok: false, error: "Некорректный order_id", status: 400 };
  }
  const mid = Math.floor(messageId);
  if (!Number.isFinite(mid) || mid <= 0) {
    return { ok: false, error: "Некорректный admin_message_id", status: 400 };
  }

  const existing = await getOrder(id);
  if (!existing) {
    return { ok: false, error: "Заказ не найден", status: 404 };
  }

  const updated: OrderRecord = { ...existing, telegram_admin_message_id: mid };
  ORDERS[id] = updated;

  const filePath = path.join(ORDERS_DIR, `${id}.json`);
  try {
    const text = await fs.readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) {
      return { ok: true };
    }
    const raw = parsed as Record<string, unknown>;
    raw.telegram_admin_message_id = mid;
    await fs.writeFile(filePath, JSON.stringify(raw, null, 2), "utf-8");
  } catch {
    /* только память */
  }

  return { ok: true };
}

/**
 * Полное удаление заказа (только статус `new` — до подтверждения в Telegram).
 */
export async function deleteOrderForOwner(
  orderId: string,
  userId: number,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const id = sanitizeOrderIdForPath(orderId);
  if (!id) {
    return { ok: false, error: "Некорректный order_id", status: 400 };
  }

  const order = await getOrder(id);
  if (!order) {
    return { ok: false, error: "Заказ не найден", status: 404 };
  }

  const owner = order.user_id;
  if (owner == null || Math.floor(owner) !== userId) {
    return { ok: false, error: "Нет доступа к этому заказу", status: 403 };
  }

  if (order.status !== "new") {
    return {
      ok: false,
      error:
        "Удалить можно только заказ в статусе «Новый» (ещё не подтверждён в Telegram). Отмените заказ или дождитесь обработки.",
      status: 409,
    };
  }

  delete ORDERS[id];
  const filePath = path.join(ORDERS_DIR, `${id}.json`);
  try {
    await fs.unlink(filePath);
  } catch {
    /* нет файла */
  }

  return { ok: true };
}

export type OrderLinePreview = {
  id: string;
  title: string;
  quantity: number;
  frontImage?: string;
  category?: string;
  rarity?: CardRarity;
};

export type OrderListSummary = {
  id: string;
  total: number;
  status: OrderStatus;
  /** Страна доставки заказа — для суммы в BYN / RUB в списке. */
  delivery?: DeliveryCountry;
  /** До 4 позиций для превью в ЛК; полный состав — на странице заказа. */
  lines?: OrderLinePreview[];
  /** Число позиций в заказе (если больше, чем в lines). */
  lineCount?: number;
};

async function enrichOrderRecordItemsIfNeeded(record: OrderRecord): Promise<void> {
  const items = record.items;
  if (!Array.isArray(items) || items.length === 0) return;
  const needs = items.some(
    (x) =>
      !sanitizeOrderLineImageUrl(x.frontImage) &&
      typeof x.id === "string" &&
      Boolean(x.id.trim()),
  );
  if (!needs) return;
  const map = await catalogImageByCardId();
  for (const it of items) {
    if (sanitizeOrderLineImageUrl(it.frontImage)) continue;
    const cid = typeof it.id === "string" ? it.id.trim() : "";
    if (!cid) continue;
    const hit = map.get(cid);
    if (!hit) continue;
    it.frontImage = hit.frontImage;
    if (!it.category && hit.category) it.category = hit.category;
    if (!it.rarity && hit.rarity) it.rarity = hit.rarity;
  }
}

let _catalogImageMapCache: Map<
  string,
  { frontImage: string; category?: string; rarity?: CardRarity }
> | null = null;

/** Обложки из каталога для старых заказов без frontImage в JSON (кэш на процесс). */
async function catalogImageByCardId(): Promise<
  Map<string, { frontImage: string; category?: string; rarity?: CardRarity }>
> {
  if (_catalogImageMapCache) return _catalogImageMapCache;
  const map = new Map<string, { frontImage: string; category?: string; rarity?: CardRarity }>();
  try {
    const p = path.join(process.cwd(), "data", "cards.json");
    const text = await fs.readFile(p, "utf-8");
    for (const c of parseCardsJson(text)) {
      const cid = typeof c.id === "string" ? c.id.trim() : "";
      if (!cid || !c.frontImage?.trim()) continue;
      const img = sanitizeOrderLineImageUrl(c.frontImage);
      if (!img) continue;
      map.set(cid, {
        frontImage: img,
        ...(typeof c.category === "string" && c.category.trim()
          ? { category: c.category.trim().slice(0, 120) }
          : {}),
        ...(c.rarity ? { rarity: c.rarity } : {}),
      });
    }
  } catch {
    /* ignore */
  }
  _catalogImageMapCache = map;
  return map;
}

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
  const catalogMap = await catalogImageByCardId();
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
    const rawItems = Array.isArray(record.items) ? record.items : [];
    const lineCount = rawItems.length;
    const lines: OrderLinePreview[] =
      lineCount === 0
        ? []
        : rawItems.slice(0, 4).map((it) => {
            const id =
              typeof it.id === "string" && it.id.trim() ? it.id.trim() : "";
            const title =
              typeof it.title === "string" && it.title.trim()
                ? it.title.trim()
                : "—";
            const preview: OrderLinePreview = {
              id,
              title,
              quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
            };
            const img = sanitizeOrderLineImageUrl(it.frontImage);
            if (img) preview.frontImage = img;
            if (typeof it.category === "string" && it.category.trim()) {
              preview.category = it.category.trim().slice(0, 120);
            }
            if (it.rarity) preview.rarity = it.rarity;
            if (!preview.frontImage && preview.id) {
              const hit = catalogMap.get(preview.id);
              if (hit) {
                preview.frontImage = hit.frontImage;
                if (!preview.category && hit.category) preview.category = hit.category;
                if (!preview.rarity && hit.rarity) preview.rarity = hit.rarity;
              }
            }
            return preview;
          });
    rows.push({
      id,
      total: record.total,
      status: record.status,
      delivery: record.delivery,
      lines: lines.length > 0 ? lines : undefined,
      lineCount: lineCount > 0 ? lineCount : undefined,
      mtime,
    });
  }
  rows.sort((a, b) => b.mtime - a.mtime);
  return rows.map((row) => {
    const { mtime: _m, ...rest } = row;
    return rest;
  });
}
