import { promises as fs } from "fs";
import path from "path";
import { parseCardsJson } from "@/app/lib/cardsJson";
import { parseCardRarity, type CardRarity } from "@/app/lib/cardRarityTags";
import { normalizeDeliveryCountry, type DeliveryCountry } from "@/app/lib/delivery";
import { orderStatusFromStorage } from "@/app/lib/orderStatus";
import { ORDERS_DIR } from "@/app/lib/orderPaths";
import type { OrderLineIn, OrderRecord, OrderStatus } from "@/app/lib/orderTypes";
import {
  bonusPointsToEarnForOrderItems,
  orderStatusEligibleForBonusAccrual,
} from "@/app/lib/bonusProgram";
import { sanitizeOrderLineImageUrl } from "@/app/lib/sanitizeOrderLineImageUrl";
import { notifyTelegramWebhookUserState } from "@/app/lib/telegramStateBotSync";
import { incrementTelegramUserBonusPoints } from "@/app/lib/telegramUserStateStore";

/**
 * In-memory заказы (сервер). При перезапуске подгружается из `data/orders/*.json`.
 */
export const ORDERS: Record<string, OrderRecord> = Object.create(null);
const BOT_ORDERS_PATH = path.join(process.cwd(), "data", "bot-orders.json");
const REDIS_ORDER_KEY = (orderId: string) => `illucards:order:${orderId}`;
const REDIS_USER_ORDERS_KEY = (userId: number) => `illucards:user-orders:${userId}`;

export function registerOrder(orderId: string, record: OrderRecord): void {
  ORDERS[orderId] = record;
}

function redisRestCredentials(): { url: string; token: string } | null {
  const u =
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim();
  const t =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim();
  if (!u || !t) return null;
  return { url: u, token: t };
}

async function redisCommand(
  cmd: unknown[],
): Promise<{ result?: unknown; error?: string } | null> {
  const cred = redisRestCredentials();
  if (!cred) return null;
  try {
    const res = await fetch(cred.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${cred.token}` },
      body: JSON.stringify(cmd),
      cache: "no-store",
    });
    return (await res.json()) as { result?: unknown; error?: string };
  } catch {
    return null;
  }
}

async function readOrderRecordFromRedis(orderId: string): Promise<OrderRecord | null> {
  const j = await redisCommand(["GET", REDIS_ORDER_KEY(orderId)]);
  if (!j || j.error || typeof j.result !== "string") return null;
  try {
    return fileToOrderRecord(JSON.parse(j.result) as unknown);
  } catch {
    return null;
  }
}

async function readBotOrderRecordFromFile(orderId: string): Promise<OrderRecord | null> {
  try {
    const text = await fs.readFile(BOT_ORDERS_PATH, "utf-8");
    const json = JSON.parse(text) as unknown;
    if (!json || typeof json !== "object" || Array.isArray(json)) return null;
    const raw = (json as Record<string, unknown>)[orderId];
    return fileToOrderRecord(raw);
  } catch {
    return null;
  }
}

async function persistOrderRecordToRedis(
  orderId: string,
  record: OrderRecord,
  score = Date.now(),
): Promise<boolean> {
  const payload = JSON.stringify({
    id: orderId,
    updatedAt: new Date(score).toISOString(),
    ...record,
  });
  const saved = await redisCommand(["SET", REDIS_ORDER_KEY(orderId), payload]);
  if (!saved || saved.error) return false;
  if (record.user_id != null && record.user_id > 0) {
    await redisCommand([
      "ZADD",
      REDIS_USER_ORDERS_KEY(Math.floor(record.user_id)),
      String(score),
      orderId,
    ]);
  }
  return true;
}

async function readUserOrderIdsFromRedis(userId: number): Promise<string[] | null> {
  const j = await redisCommand([
    "ZREVRANGE",
    REDIS_USER_ORDERS_KEY(Math.floor(userId)),
    "0",
    "199",
  ]);
  if (!j || j.error || !Array.isArray(j.result)) return null;
  return j.result.filter((x): x is string => typeof x === "string");
}

export async function saveOrderRecord(
  orderId: string,
  record: OrderRecord,
  createdAt = new Date(),
): Promise<void> {
  registerOrder(orderId, record);
  await persistOrderRecordToRedis(orderId, record, createdAt.getTime());

  try {
    await fs.mkdir(ORDERS_DIR, { recursive: true });
    await fs.writeFile(
      path.join(ORDERS_DIR, `${orderId}.json`),
      JSON.stringify(
        {
          id: orderId,
          createdAt: createdAt.toISOString(),
          ...record,
        },
        null,
        2,
      ),
      "utf-8",
    );
  } catch {
    /* На serverless/readonly FS остаёмся на Redis/in-memory. */
  }
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

  const bonus_awarded = o.bonus_awarded === true || o.bonus_awarded === "true";
  const bpsRaw = o.bonus_points_spent;
  const bonus_points_spent =
    typeof bpsRaw === "number" && Number.isFinite(bpsRaw) && bpsRaw > 0
      ? Math.floor(bpsRaw)
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
    ...(bonus_awarded ? { bonus_awarded: true as const } : {}),
    ...(bonus_points_spent != null && bonus_points_spent > 0
      ? { bonus_points_spent }
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

  const redisRecord = await readOrderRecordFromRedis(id);
  if (redisRecord) {
    await enrichOrderRecordItemsIfNeeded(redisRecord);
    ORDERS[id] = redisRecord;
    return redisRecord;
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
    const botRecord = await readBotOrderRecordFromFile(id);
    if (!botRecord) return null;
    await enrichOrderRecordItemsIfNeeded(botRecord);
    ORDERS[id] = botRecord;
    return botRecord;
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
  await persistOrderRecordToRedis(id, updated);

  const filePath = path.join(ORDERS_DIR, `${id}.json`);
  try {
    const text = await fs.readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null) {
      const raw = parsed as Record<string, unknown>;
      raw.status = status;
      if (updated.telegram_admin_message_id != null) {
        raw.telegram_admin_message_id = updated.telegram_admin_message_id;
      }
      await fs.writeFile(filePath, JSON.stringify(raw, null, 2), "utf-8");
    }
  } catch {
    /* нет файла или FS только для чтения — статус уже в ORDERS */
  }

  const nowBonusEligible =
    orderStatusEligibleForBonusAccrual(status) &&
    existing.status !== "cancelled" &&
    status !== "cancelled";
  const grantBonusNow =
    nowBonusEligible &&
    !existing.bonus_awarded &&
    existing.user_id != null &&
    existing.user_id > 0;
  if (grantBonusNow) {
    const earn = bonusPointsToEarnForOrderItems(existing.items);
    if (earn > 0) {
      try {
        const uid = Math.floor(existing.user_id!);
        const st = await incrementTelegramUserBonusPoints(uid, earn);
        ORDERS[id] = { ...ORDERS[id]!, bonus_awarded: true };
        await persistOrderRecordToRedis(id, ORDERS[id]!);
        await notifyTelegramWebhookUserState({
          userId: uid,
          cart: st.cart,
          favorites: st.favorites,
          deliveryCountry: st.deliveryCountry,
          bonus_points: st.bonus_points,
        });
        try {
          const text2 = await fs.readFile(filePath, "utf-8");
          const parsed2: unknown = JSON.parse(text2);
          if (typeof parsed2 === "object" && parsed2 !== null) {
            const raw2 = parsed2 as Record<string, unknown>;
            raw2.bonus_awarded = true;
            await fs.writeFile(filePath, JSON.stringify(raw2, null, 2), "utf-8");
          }
        } catch {
          /* ignore */
        }
      } catch {
        /* начисление бонусов не должно ломать смену статуса */
      }
    }
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
  await persistOrderRecordToRedis(id, updated);

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
  await redisCommand(["DEL", REDIS_ORDER_KEY(id)]);
  await redisCommand(["ZREM", REDIS_USER_ORDERS_KEY(userId), id]);
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
  const redisIds = await readUserOrderIdsFromRedis(uid);
  if (redisIds && redisIds.length > 0) {
    const rows: OrderListSummary[] = [];
    const seen = new Set<string>();
    const catalogMap = await catalogImageByCardId();
    for (const id of redisIds) {
      if (!id || id.length > 200 || /[/\\]/.test(id) || id.includes("..")) continue;
      const record = await getOrder(id);
      if (!record || record.user_id !== uid) continue;
      seen.add(id);
      rows.push(orderSummaryFromRecord(id, record, catalogMap));
    }
    rows.push(...(await listBotOrderSummariesForUser(uid, catalogMap, seen)));
    return rows;
  }

  let files: string[] = [];
  try {
    files = await fs.readdir(ORDERS_DIR);
  } catch {
    files = [];
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
    rows.push({
      ...orderSummaryFromRecord(id, record, catalogMap),
      mtime,
    });
  }
  rows.push(...(await listBotOrderSummariesForUser(uid, catalogMap, new Set(rows.map((r) => r.id)))));
  rows.sort((a, b) => b.mtime - a.mtime);
  return rows.map((row) => ({
    id: row.id,
    total: row.total,
    status: row.status,
    delivery: row.delivery,
    ...(row.lines ? { lines: row.lines } : {}),
    ...(row.lineCount ? { lineCount: row.lineCount } : {}),
  }));
}

async function listBotOrderSummariesForUser(
  uid: number,
  catalogMap: Map<string, { frontImage: string; category?: string; rarity?: CardRarity }>,
  seen: Set<string>,
): Promise<Array<OrderListSummary & { mtime: number }>> {
  let raw: unknown;
  let mtime = 0;
  try {
    const st = await fs.stat(BOT_ORDERS_PATH);
    mtime = st.mtimeMs;
    raw = JSON.parse(await fs.readFile(BOT_ORDERS_PATH, "utf-8")) as unknown;
  } catch {
    return [];
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const rows: Array<OrderListSummary & { mtime: number }> = [];
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!id || id.length > 200 || /[/\\]/.test(id) || id.includes("..") || seen.has(id)) {
      continue;
    }
    const record = fileToOrderRecord(value);
    if (!record || record.user_id !== uid) continue;
    await enrichOrderRecordItemsIfNeeded(record);
    ORDERS[id] = record;
    rows.push({
      ...orderSummaryFromRecord(id, record, catalogMap),
      mtime,
    });
  }
  return rows;
}

function orderSummaryFromRecord(
  id: string,
  record: OrderRecord,
  catalogMap: Map<string, { frontImage: string; category?: string; rarity?: CardRarity }>,
): OrderListSummary {
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const lineCount = rawItems.length;
  const lines: OrderLinePreview[] =
    lineCount === 0
      ? []
      : rawItems.slice(0, 4).map((it) => {
          const itemId =
            typeof it.id === "string" && it.id.trim() ? it.id.trim() : "";
          const title =
            typeof it.title === "string" && it.title.trim()
              ? it.title.trim()
              : "—";
          const preview: OrderLinePreview = {
            id: itemId,
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
  return {
    id,
    total: record.total,
    status: record.status,
    delivery: record.delivery,
    lines: lines.length > 0 ? lines : undefined,
    lineCount: lineCount > 0 ? lineCount : undefined,
  };
}
