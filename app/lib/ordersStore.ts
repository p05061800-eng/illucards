import { promises as fs } from "fs";
import path from "path";
import { parseCardsJson } from "@/app/lib/cardsJson";
import { parseCardRarity, type CardRarity } from "@/app/lib/cardRarityTags";
import { normalizeDeliveryCountry, type DeliveryCountry } from "@/app/lib/delivery";
import { displayRefForRecord } from "@/app/lib/orderDisplayRef";
import { orderStatusFromStorage } from "@/app/lib/orderStatus";
import { ORDERS_DIR } from "@/app/lib/orderPaths";
import type { OrderPaymentMethod } from "@/app/lib/orderPayment";
import { parseOrderPaymentMethod } from "@/app/lib/orderPayment";
import type { OrderLineIn, OrderRecord, OrderStatus } from "@/app/lib/orderTypes";
import {
  bonusPointsToEarnForOrderItems,
  orderStatusEligibleForBonusAccrual,
} from "@/app/lib/bonusProgram";
import { sanitizeOrderLineImageUrl } from "@/app/lib/sanitizeOrderLineImageUrl";
import { notifyTelegramWebhookUserState } from "@/app/lib/telegramStateBotSync";
import {
  incrementTelegramUserBonusPoints,
  trySpendTelegramUserBonusPoints,
} from "@/app/lib/telegramUserStateStore";

/**
 * In-memory заказы (сервер). При перезапуске подгружается из `data/orders/*.json`.
 */
export const ORDERS: Record<string, OrderRecord> = Object.create(null);
const BOT_ORDERS_PATH = path.join(process.cwd(), "data", "bot-orders.json");
const REDIS_ORDER_KEY = (orderId: string) => `illucards:order:${orderId}`;
const REDIS_USER_ORDERS_KEY = (userId: number) => `illucards:user-orders:${userId}`;
const REDIS_USER_HIDDEN_ORDERS_KEY = (userId: number) => `illucards:user-hidden-orders:${userId}`;

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

async function readHiddenOrderIdsForUser(userId: number): Promise<Set<string>> {
  const j = await redisCommand(["SMEMBERS", REDIS_USER_HIDDEN_ORDERS_KEY(Math.floor(userId))]);
  if (!j || j.error || !Array.isArray(j.result)) return new Set();
  return new Set(j.result.filter((x): x is string => typeof x === "string"));
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
  const bonus_points_deducted =
    o.bonus_points_deducted === true || o.bonus_points_deducted === "true";
  const bonus_points_refunded =
    o.bonus_points_refunded === true || o.bonus_points_refunded === "true";
  const bpsRaw = o.bonus_points_spent;
  const bonus_points_spent =
    typeof bpsRaw === "number" && Number.isFinite(bpsRaw) && bpsRaw > 0
      ? Math.floor(bpsRaw)
      : undefined;

  const payment_method = parseOrderPaymentMethod(o.payment_method) ?? undefined;

  const telegram_buyer_notified =
    o.telegram_buyer_notified === true || o.telegram_buyer_notified === "true";

  const delivery_details_raw = o.delivery_details;
  const delivery_details =
    typeof delivery_details_raw === "string" && delivery_details_raw.trim()
      ? delivery_details_raw.trim().slice(0, 4000)
      : undefined;

  const buyerSeqRaw = o.buyer_seq;
  const buyer_seq =
    typeof buyerSeqRaw === "number" &&
    Number.isFinite(buyerSeqRaw) &&
    buyerSeqRaw > 0 &&
    buyerSeqRaw <= 1_000_000
      ? Math.floor(buyerSeqRaw)
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
    ...(bonus_points_deducted ? { bonus_points_deducted: true as const } : {}),
    ...(bonus_points_refunded ? { bonus_points_refunded: true as const } : {}),
    ...(bonus_points_spent != null && bonus_points_spent > 0
      ? { bonus_points_spent }
      : {}),
    ...(payment_method ? { payment_method } : {}),
    ...(telegram_buyer_notified ? { telegram_buyer_notified: true as const } : {}),
    ...(delivery_details ? { delivery_details } : {}),
    ...(buyer_seq != null ? { buyer_seq } : {}),
  };
}

async function collectOrderIdsForUser(userId: number): Promise<string[]> {
  const uid = Math.floor(userId);
  const seen = new Set<string>();
  const ids: string[] = [];

  const push = (id: string) => {
    const t = id.trim();
    if (!t || t.length > 200 || /[/\\]/.test(t) || t.includes("..") || seen.has(t)) {
      return;
    }
    seen.add(t);
    ids.push(t);
  };

  const redisIds = await readUserOrderIdsFromRedis(uid);
  if (redisIds) {
    for (const id of redisIds) push(id);
  }

  let files: string[] = [];
  try {
    files = await fs.readdir(ORDERS_DIR);
  } catch {
    files = [];
  }
  for (const f of files) {
    if (!f.toLowerCase().endsWith(".json")) continue;
    push(f.replace(/\.json$/i, ""));
  }

  try {
    const text = await fs.readFile(BOT_ORDERS_PATH, "utf-8");
    const json = JSON.parse(text) as unknown;
    if (json && typeof json === "object" && !Array.isArray(json)) {
      for (const id of Object.keys(json as Record<string, unknown>)) {
        push(id);
      }
    }
  } catch {
    /* ignore */
  }

  for (const id of Object.keys(ORDERS)) {
    push(id);
  }

  return ids;
}

async function nextBuyerOrderSeq(
  userId: number,
  excludeOrderId?: string,
): Promise<number> {
  const uid = Math.floor(userId);
  const ex = (excludeOrderId || "").trim();
  let maxSeq = 0;
  const ids = await collectOrderIdsForUser(uid);
  for (const id of ids) {
    if (ex && id === ex) continue;
    const rec = await getOrder(id);
    if (!rec || rec.user_id !== uid) continue;
    const seq = rec.buyer_seq ?? 0;
    if (seq > maxSeq) maxSeq = seq;
  }
  return maxSeq + 1;
}

async function persistBuyerSeq(
  orderId: string,
  record: OrderRecord,
  buyerSeq: number,
): Promise<void> {
  const id = sanitizeOrderIdForPath(orderId);
  if (!id) return;
  const seq = Math.floor(buyerSeq);
  if (seq <= 0) return;
  const updated: OrderRecord = { ...record, buyer_seq: seq };
  ORDERS[id] = updated;
  await persistOrderRecordToRedis(id, updated);
  const filePath = path.join(ORDERS_DIR, `${id}.json`);
  try {
    const text = await fs.readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null) {
      await fs.writeFile(
        filePath,
        JSON.stringify(
          { ...(parsed as Record<string, unknown>), buyer_seq: seq },
          null,
          2,
        ),
        "utf-8",
      );
    }
  } catch {
    /* ignore */
  }
}

/** Старым заказам без buyer_seq присваиваем 1, 2, 3… (как в боте). */
export async function ensureBuyerSeqsForUser(userId: number): Promise<void> {
  if (!Number.isFinite(userId) || userId <= 0) return;
  const uid = Math.floor(userId);
  const ids = await collectOrderIdsForUser(uid);
  ids.sort();
  for (const id of ids) {
    const rec = await getOrder(id);
    if (!rec || rec.user_id !== uid || (rec.buyer_seq ?? 0) > 0) continue;
    const seq = await nextBuyerOrderSeq(uid, id);
    await persistBuyerSeq(id, rec, seq);
  }
}

export async function assignBuyerSeqForNewOrder(
  userId: number,
): Promise<number | undefined> {
  if (!Number.isFinite(userId) || userId <= 0) return undefined;
  return nextBuyerOrderSeq(Math.floor(userId));
}

export async function markOrderTelegramBuyerNotified(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const id = sanitizeOrderIdForPath(orderId);
  if (!id) {
    return { ok: false, error: "Некорректный order_id", status: 400 };
  }
  const existing = await getOrder(id);
  if (!existing) {
    return { ok: false, error: "Заказ не найден", status: 404 };
  }
  if (existing.telegram_buyer_notified) {
    return { ok: true };
  }
  const updated: OrderRecord = { ...existing, telegram_buyer_notified: true };
  ORDERS[id] = updated;
  await persistOrderRecordToRedis(id, updated);
  const filePath = path.join(ORDERS_DIR, `${id}.json`);
  try {
    const text = await fs.readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null) {
      await fs.writeFile(
        filePath,
        JSON.stringify(
          { ...(parsed as Record<string, unknown>), telegram_buyer_notified: true },
          null,
          2,
        ),
        "utf-8",
      );
    }
  } catch {
    /* ignore */
  }
  return { ok: true };
}

/** Вернуть заказ: сначала память, иначе файл. */
export async function getOrder(orderId: string): Promise<OrderRecord | null> {
  if (!orderId || typeof orderId !== "string") return null;
  if (orderId.length > 200 || /[/\\]/.test(orderId) || orderId.includes("..")) {
    return null;
  }
  const id = orderId.trim();
  if (!id) return null;

  let record: OrderRecord | null = ORDERS[id] ?? null;
  if (!record) {
    record = await readOrderRecordFromRedis(id);
  }
  if (!record) {
    const filePath = path.join(ORDERS_DIR, `${id}.json`);
    try {
      const text = await fs.readFile(filePath, "utf-8");
      const json = JSON.parse(text) as unknown;
      record = fileToOrderRecord(json);
    } catch {
      record = await readBotOrderRecordFromFile(id);
    }
  }
  if (!record) return null;
  await enrichOrderRecordItemsIfNeeded(record);
  if (
    record.user_id != null &&
    record.user_id > 0 &&
    !(record.buyer_seq != null && record.buyer_seq > 0)
  ) {
    const seq = await nextBuyerOrderSeq(record.user_id, id);
    await persistBuyerSeq(id, record, seq);
    record = ORDERS[id] ?? { ...record, buyer_seq: seq };
  } else {
    ORDERS[id] = record;
  }
  return record;
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
export async function updateOrderPaymentMethod(
  orderId: string,
  paymentMethod: OrderPaymentMethod,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const id = sanitizeOrderIdForPath(orderId);
  if (!id) {
    return { ok: false, error: "Некорректный order_id", status: 400 };
  }
  const existing = await getOrder(id);
  if (!existing) {
    return { ok: false, error: "Заказ не найден", status: 404 };
  }
  const updated: OrderRecord = { ...existing, payment_method: paymentMethod };
  ORDERS[id] = updated;
  await persistOrderRecordToRedis(id, updated);
  const filePath = path.join(ORDERS_DIR, `${id}.json`);
  try {
    const text = await fs.readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null) {
      await fs.writeFile(
        filePath,
        JSON.stringify({ ...(parsed as Record<string, unknown>), payment_method: paymentMethod }, null, 2),
        "utf-8",
      );
    }
  } catch {
    /* ignore */
  }
  return { ok: true };
}

export async function updateOrderDeliveryDetails(
  orderId: string,
  deliveryDetails: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const id = sanitizeOrderIdForPath(orderId);
  if (!id) {
    return { ok: false, error: "Некорректный order_id", status: 400 };
  }
  const text = deliveryDetails.trim().slice(0, 4000);
  if (!text) {
    return { ok: false, error: "Пустые данные доставки", status: 400 };
  }
  const existing = await getOrder(id);
  if (!existing) {
    return { ok: false, error: "Заказ не найден", status: 404 };
  }
  const updated: OrderRecord = { ...existing, delivery_details: text };
  ORDERS[id] = updated;
  await persistOrderRecordToRedis(id, updated);
  const filePath = path.join(ORDERS_DIR, `${id}.json`);
  try {
    const rawText = await fs.readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(rawText);
    if (typeof parsed === "object" && parsed !== null) {
      await fs.writeFile(
        filePath,
        JSON.stringify(
          { ...(parsed as Record<string, unknown>), delivery_details: text },
          null,
          2,
        ),
        "utf-8",
      );
    }
  } catch {
    try {
      await fs.mkdir(ORDERS_DIR, { recursive: true });
      await fs.writeFile(
        filePath,
        JSON.stringify(
          { id, createdAt: new Date().toISOString(), ...updated },
          null,
          2,
        ),
        "utf-8",
      );
    } catch {
      /* readonly FS — остаётся Redis/in-memory */
    }
  }
  return { ok: true };
}

export type AdminOrderRow = {
  id: string;
  displayRef: string;
  total: number;
  status: OrderStatus;
  delivery: OrderRecord["delivery"];
  user_id?: number;
  username: string | null;
  payment_method?: OrderPaymentMethod;
  createdAt?: string;
};

export async function listRecentOrders(limit = 40): Promise<AdminOrderRow[]> {
  const cap = Math.min(200, Math.max(1, Math.floor(limit)));
  const rows: Array<AdminOrderRow & { sortKey: number }> = [];
  const seen = new Set<string>();

  const cred = redisRestCredentials();
  if (cred) {
    try {
      const res = await fetch(cred.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${cred.token}` },
        body: JSON.stringify(["KEYS", "illucards:order:*"]),
        cache: "no-store",
      });
      const j = (await res.json()) as { result?: unknown };
      const keys = Array.isArray(j.result)
        ? j.result.filter((k): k is string => typeof k === "string")
        : [];
      for (const key of keys) {
        const id = key.replace(/^illucards:order:/, "").trim();
        if (!id || seen.has(id)) continue;
        const record = await getOrder(id);
        if (!record) continue;
        seen.add(id);
        rows.push({
          id,
          displayRef: displayRefForRecord(id, record),
          total: record.total,
          status: record.status,
          delivery: record.delivery,
          ...(record.user_id != null ? { user_id: record.user_id } : {}),
          username: record.username,
          ...(record.payment_method ? { payment_method: record.payment_method } : {}),
          sortKey: Date.now(),
        });
      }
    } catch {
      /* fallback below */
    }
  }

  let files: string[] = [];
  try {
    files = await fs.readdir(ORDERS_DIR);
  } catch {
    files = [];
  }
  for (const f of files) {
    if (!f.toLowerCase().endsWith(".json")) continue;
    const id = f.replace(/\.json$/i, "");
    if (!id || seen.has(id)) continue;
    const record = await getOrder(id);
    if (!record) continue;
    seen.add(id);
    let sortKey = 0;
    try {
      const st = await fs.stat(path.join(ORDERS_DIR, f));
      sortKey = st.mtimeMs;
    } catch {
      sortKey = 0;
    }
    let createdAt: string | undefined;
    try {
      const text = await fs.readFile(path.join(ORDERS_DIR, f), "utf-8");
      const parsed = JSON.parse(text) as { createdAt?: unknown };
      if (typeof parsed.createdAt === "string") createdAt = parsed.createdAt;
    } catch {
      /* ignore */
    }
    rows.push({
      id,
      displayRef: displayRefForRecord(id, record),
      total: record.total,
      status: record.status,
      delivery: record.delivery,
      ...(record.user_id != null ? { user_id: record.user_id } : {}),
      username: record.username,
      ...(record.payment_method ? { payment_method: record.payment_method } : {}),
      ...(createdAt ? { createdAt } : {}),
      sortKey,
    });
  }

  rows.sort((a, b) => b.sortKey - a.sortKey);
  return rows.slice(0, cap).map((row) => {
    const { sortKey: _discard, ...rest } = row;
    void _discard;
    return rest;
  });
}

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

  const nowBonusEligible =
    orderStatusEligibleForBonusAccrual(status) &&
    existing.status !== "cancelled" &&
    status !== "cancelled";
  const spend = Math.max(0, Math.floor(existing.bonus_points_spent ?? 0));
  let bonusRefundedNow = false;
  const refundBonusNow =
    status === "cancelled" &&
    existing.status !== "cancelled" &&
    existing.bonus_points_deducted &&
    !existing.bonus_points_refunded &&
    spend > 0 &&
    existing.user_id != null &&
    existing.user_id > 0;
  if (refundBonusNow) {
    const uid = Math.floor(existing.user_id!);
    const st = await incrementTelegramUserBonusPoints(uid, spend);
    bonusRefundedNow = true;
    await notifyTelegramWebhookUserState({
      userId: uid,
      cart: st.cart,
      favorites: st.favorites,
      deliveryCountry: st.deliveryCountry,
      bonus_points: st.bonus_points,
    });
  }
  const deductBonusNow =
    nowBonusEligible &&
    spend > 0 &&
    !existing.bonus_points_deducted &&
    existing.user_id != null &&
    existing.user_id > 0;
  let bonusDeductedNow = false;
  if (deductBonusNow) {
    const uid = Math.floor(existing.user_id!);
    const spent = await trySpendTelegramUserBonusPoints(uid, spend);
    if (!spent.ok) {
      return { ok: false, error: "Недостаточно бонусов для списания", status: 409 };
    }
    bonusDeductedNow = true;
    await notifyTelegramWebhookUserState({
      userId: uid,
      cart: spent.state.cart,
      favorites: spent.state.favorites,
      deliveryCountry: spent.state.deliveryCountry,
      bonus_points: spent.state.bonus_points,
    });
  }
  const updated: OrderRecord = {
    ...existing,
    status,
    ...(bonusDeductedNow ? { bonus_points_deducted: true } : {}),
    ...(bonusRefundedNow ? { bonus_points_refunded: true } : {}),
  };
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
      if (updated.bonus_points_deducted) {
        raw.bonus_points_deducted = true;
      }
      if (updated.bonus_points_refunded) {
        raw.bonus_points_refunded = true;
      }
      await fs.writeFile(filePath, JSON.stringify(raw, null, 2), "utf-8");
    }
  } catch {
    /* нет файла или FS только для чтения — статус уже в ORDERS */
  }
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
          bonusEarned: earn,
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

export async function hideOrderForOwner(
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

  const uid = Math.floor(userId);
  await redisCommand(["SADD", REDIS_USER_HIDDEN_ORDERS_KEY(uid), id]);
  await redisCommand(["ZREM", REDIS_USER_ORDERS_KEY(uid), id]);
  return { ok: true };
}

async function redisKeys(pattern: string): Promise<string[]> {
  const j = await redisCommand(["KEYS", pattern]);
  if (!j || j.error || !Array.isArray(j.result)) return [];
  return j.result.filter((x): x is string => typeof x === "string");
}

/** Полная очистка всех заказов (Redis, файлы, память). Для сброса перед новым тестом. */
export async function purgeAllOrders(): Promise<{ siteDeleted: number }> {
  let siteDeleted = 0;
  for (const key of Object.keys(ORDERS)) {
    delete ORDERS[key];
  }

  const patterns = [
    "illucards:order:*",
    "illucards:user-orders:*",
    "illucards:user-hidden-orders:*",
  ] as const;
  for (const pattern of patterns) {
    const keys = await redisKeys(pattern);
    for (const key of keys) {
      await redisCommand(["DEL", key]);
      if (pattern === "illucards:order:*") siteDeleted += 1;
    }
  }

  try {
    const files = await fs.readdir(ORDERS_DIR);
    for (const f of files) {
      if (!f.toLowerCase().endsWith(".json")) continue;
      await fs.unlink(path.join(ORDERS_DIR, f));
      siteDeleted += 1;
    }
  } catch {
    /* нет каталога */
  }

  try {
    await fs.mkdir(path.dirname(BOT_ORDERS_PATH), { recursive: true });
    await fs.writeFile(BOT_ORDERS_PATH, "{}\n", "utf-8");
  } catch {
    /* ignore */
  }

  return { siteDeleted };
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
  /** miheevlil1 — как в Telegram-боте. */
  displayRef: string;
  buyer_seq?: number;
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
  await ensureBuyerSeqsForUser(uid);
  const hidden = await readHiddenOrderIdsForUser(uid);
  const redisIds = await readUserOrderIdsFromRedis(uid);
  if (redisIds && redisIds.length > 0) {
    const rows: OrderListSummary[] = [];
    const seen = new Set<string>();
    const catalogMap = await catalogImageByCardId();
    for (const id of redisIds) {
      if (!id || id.length > 200 || /[/\\]/.test(id) || id.includes("..")) continue;
      if (hidden.has(id)) continue;
      const record = await getOrder(id);
      if (!record || record.user_id !== uid) continue;
      seen.add(id);
      rows.push(orderSummaryFromRecord(id, record, catalogMap));
    }
    rows.push(...(await listBotOrderSummariesForUser(uid, catalogMap, seen, hidden)));
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
    if (hidden.has(id)) continue;
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
  rows.push(...(await listBotOrderSummariesForUser(uid, catalogMap, new Set(rows.map((r) => r.id)), hidden)));
  rows.sort((a, b) => b.mtime - a.mtime);
  return rows.map((row) => ({
    id: row.id,
    displayRef: row.displayRef,
    ...(row.buyer_seq != null && row.buyer_seq > 0 ? { buyer_seq: row.buyer_seq } : {}),
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
  hidden: Set<string>,
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
    if (!id || id.length > 200 || /[/\\]/.test(id) || id.includes("..") || seen.has(id) || hidden.has(id)) {
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

export async function reconcileBonusPointsForUser(userId: number): Promise<number> {
  if (!Number.isFinite(userId) || userId <= 0) return 0;
  const uid = Math.floor(userId);
  const rows = await listOrdersForUser(uid);
  let awarded = 0;
  for (const row of rows) {
    const record = await getOrder(row.id);
    if (
      !record ||
      record.user_id !== uid ||
      record.bonus_awarded ||
      !orderStatusEligibleForBonusAccrual(record.status)
    ) {
      continue;
    }
    const before = bonusPointsToEarnForOrderItems(record.items);
    if (before <= 0) continue;
    const result = await updateOrderStatus(row.id, record.status);
    if (result.ok) awarded += before;
  }
  return awarded;
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
    displayRef: displayRefForRecord(id, record),
    ...(record.buyer_seq != null && record.buyer_seq > 0
      ? { buyer_seq: record.buyer_seq }
      : {}),
    total: record.total,
    status: record.status,
    delivery: record.delivery,
    lines: lines.length > 0 ? lines : undefined,
    lineCount: lineCount > 0 ? lineCount : undefined,
  };
}
