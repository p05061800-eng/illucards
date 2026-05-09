import { randomUUID } from "crypto";
import { parseCardRarity } from "@/app/lib/cardRarityTags";
import { bonusDiscountByn, maxSpendableBonusPoints } from "@/app/lib/bonusProgram";
import { deliveryCharge, normalizeDeliveryCountry, type DeliveryCountry } from "@/app/lib/delivery";
import type { OrderLineIn, OrderRecord } from "@/app/lib/orderTypes";
import { saveOrderRecord } from "@/app/lib/ordersStore";
import { sanitizeOrderLineImageUrl } from "@/app/lib/sanitizeOrderLineImageUrl";
import {
  getTelegramUserState,
  trySpendTelegramUserBonusPoints,
} from "@/app/lib/telegramUserStateStore";

export { ORDERS_DIR } from "@/app/lib/orderPaths";
export type { OrderLineIn } from "@/app/lib/orderTypes";

export function parseDeliveryCountry(v: unknown): DeliveryCountry | null {
  return normalizeDeliveryCountry(v);
}

export function parseOptionalTelegramUserId(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 1e12) return undefined;
  return Math.floor(n);
}

export function parseOptionalUsername(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim().replace(/^@/, "").slice(0, 64);
  if (!/^[a-zA-Z0-9_]*$/.test(t)) return undefined;
  return t || null;
}

export function parseOptionalBonusPointsToSpend(v: unknown): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(1_000_000_000, Math.floor(n));
}

export function normalizeOrderItems(raw: unknown): OrderLineIn[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  if (raw.length > 80) return null;
  const out: OrderLineIn[] = [];
  for (const row of raw) {
    if (typeof row !== "object" || row === null) return null;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const q = typeof o.quantity === "number" ? o.quantity : Number(o.quantity);
    const priceByn =
      typeof o.priceByn === "number" ? o.priceByn : Number(o.priceByn);
    const priceRub =
      typeof o.priceRub === "number" ? o.priceRub : Number(o.priceRub);
    if (!id || !title) return null;
    if (!Number.isFinite(q) || q < 1 || q > 99 || !Number.isInteger(q))
      return null;
    if (!Number.isFinite(priceByn) || priceByn < 0 || priceByn > 1_000_000)
      return null;
    if (!Number.isFinite(priceRub) || priceRub < 0 || priceRub > 50_000_000)
      return null;
    const lineOut: OrderLineIn = {
      id: id.slice(0, 120),
      title: title.slice(0, 300),
      quantity: q,
      priceByn,
      priceRub: Math.round(priceRub),
    };
    const img = sanitizeOrderLineImageUrl(o.frontImage);
    if (img) lineOut.frontImage = img;
    const catRaw = o.category;
    if (typeof catRaw === "string") {
      const cat = catRaw.trim().slice(0, 120);
      if (cat) lineOut.category = cat;
    }
    if (typeof o.rarity === "string" && o.rarity.trim()) {
      lineOut.rarity = parseCardRarity(o.rarity);
    }
    out.push(lineOut);
  }
  return out;
}

const TOTAL_EPS = 0.05;

export type PersistOrderInput = {
  deliveryCountry: DeliveryCountry;
  items: OrderLineIn[];
  userId?: number;
  username?: string | null;
  clientTotalByn: number;
  /** Сколько бонусных баллов списать (после проверки баланса и лимита по сумме). */
  bonusPointsToSpend?: number;
};

export type PersistOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string; status: number };

/** Сохраняет заказ в ORDERS и на диск. */
export async function persistOrder(
  input: PersistOrderInput,
): Promise<PersistOrderResult> {
  const {
    deliveryCountry,
    items,
    userId,
    username,
    clientTotalByn,
    bonusPointsToSpend: rawBonusSpend = 0,
  } = input;

  if (!Number.isFinite(clientTotalByn) || clientTotalByn < 0) {
    return { ok: false, error: "Некорректная сумма заказа", status: 400 };
  }

  const goodsByn =
    Math.round(
      items.reduce((s, l) => s + l.priceByn * l.quantity, 0) * 100,
    ) / 100;
  const d = deliveryCharge(deliveryCountry);
  const orderBynBefore = Math.round((goodsByn + d.amountByn) * 100) / 100;

  let spendApplied = 0;
  const wantSpend = Math.max(0, Math.floor(Number(rawBonusSpend) || 0));
  if (wantSpend > 0) {
    if (userId == null || userId <= 0) {
      return {
        ok: false,
        error: "Чтобы списать бонусы, войдите через Telegram",
        status: 401,
      };
    }
    const balState = await getTelegramUserState(userId);
    const balance = Math.max(0, Math.floor(balState?.bonus_points ?? 0));
    spendApplied = Math.min(
      wantSpend,
      maxSpendableBonusPoints(balance, orderBynBefore, deliveryCountry),
    );
  }

  const discountByn = bonusDiscountByn(spendApplied, deliveryCountry);
  const orderBynCharged = Math.round((orderBynBefore - discountByn) * 100) / 100;
  if (orderBynCharged < -TOTAL_EPS) {
    return { ok: false, error: "Некорректная скидка бонусами", status: 400 };
  }

  if (Math.abs(orderBynCharged - clientTotalByn) > TOTAL_EPS) {
    return { ok: false, error: "Сумма заказа не совпадает с корзиной", status: 400 };
  }

  if (spendApplied > 0 && userId != null && userId > 0) {
    const spent = await trySpendTelegramUserBonusPoints(userId, spendApplied);
    if (!spent.ok) {
      return { ok: false, error: "Недостаточно бонусов", status: 409 };
    }
  }

  const orderId = randomUUID();

  const record: OrderRecord = {
    ...(userId != null && userId > 0 ? { user_id: userId } : {}),
    username: username ?? null,
    items,
    total: orderBynCharged,
    delivery: deliveryCountry,
    status: "new",
    ...(spendApplied > 0 ? { bonus_points_spent: spendApplied } : {}),
  };

  await saveOrderRecord(orderId, record);

  return { ok: true, orderId };
}
