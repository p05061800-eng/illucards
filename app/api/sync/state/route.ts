import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { normalizeDeliveryCountry, type DeliveryCountry } from "@/app/lib/delivery";
import {
  getTelegramUserState,
  saveTelegramUserState,
  type SyncedCartItem,
} from "@/app/lib/telegramUserStateStore";

function syncSecretOk(request: NextRequest): boolean {
  const need = process.env.TELEGRAM_SYNC_API_SECRET?.trim();
  if (!need) return true;
  const got = (request.headers.get("x-sync-secret") || "").trim();
  return got === need;
}

function parseCartFromBotSync(raw: unknown): SyncedCartItem[] {
  if (!Array.isArray(raw)) return [];
  const out: SyncedCartItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = typeof o.ref === "string" ? o.ref.trim().slice(0, 120) : "";
    const title = typeof o.name === "string" ? o.name.trim().slice(0, 300) : "";
    const qtyRaw = o.qty ?? o.quantity;
    const q = Math.max(1, Math.min(99, Math.floor(Number(qtyRaw) || 1)));
    const priceByn = Number.isFinite(Number(o.price)) ? Number(o.price) : 0;
    const priceRubRaw = o.price_rub ?? o.priceRub;
    const priceRub = Number.isFinite(Number(priceRubRaw)) ? Math.round(Number(priceRubRaw)) : 0;
    if (!id || !title) continue;
    out.push({ id, title, quantity: q, priceByn, priceRub });
  }
  return out.slice(0, 200);
}

function parseFavoritesFromBotSync(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const ref = (row as Record<string, unknown>).ref;
    if (typeof ref === "string" && ref.trim()) out.push(ref.trim().slice(0, 120));
  }
  return out.slice(0, 500);
}

function parseUserId(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 1e12) return null;
  return Math.floor(n);
}

/**
 * POST /api/sync/state — приём пуша состояния (корзина / избранное / доставка) с сайта.
 * Вызывается из `notifyTelegramWebhookUserState` при настроенном TELEGRAM_SYNC_API_URL
 * (часто тот же origin, что и сайт).
 *
 * Заголовок X-Sync-Secret обязателен, если задан TELEGRAM_SYNC_API_SECRET.
 */
export async function POST(request: NextRequest) {
  if (!syncSecretOk(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ожидается объект" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const userId = parseUserId(o.user_id);
  if (userId == null) {
    return NextResponse.json({ error: "Некорректный user_id" }, { status: 400 });
  }

  const prev = await getTelegramUserState(userId);
  const cart = parseCartFromBotSync(o.cart);
  const favorites = parseFavoritesFromBotSync(o.favorites);
  let deliveryCountry: DeliveryCountry | null = null;
  if (o.delivery_country === null || o.delivery_country === undefined) {
    deliveryCountry = null;
  } else {
    deliveryCountry = normalizeDeliveryCountry(o.delivery_country);
  }
  const prevBonusPoints = Math.max(0, Math.floor(prev?.bonus_points ?? 0));
  let bonus_points = prevBonusPoints;
  const bpRaw = o.bonus_points;
  if (bpRaw !== undefined && bpRaw !== null) {
    const n = typeof bpRaw === "number" ? bpRaw : Number(bpRaw);
    if (Number.isFinite(n) && n >= 0 && n <= 1e9) {
      bonus_points = Math.max(prevBonusPoints, Math.floor(n));
    }
  }

  const saved = await saveTelegramUserState(userId, {
    cart,
    favorites,
    deliveryCountry,
    bonus_points,
  });

  return NextResponse.json({
    ok: true,
    updatedAt: saved.updatedAt,
    bonus_points: saved.bonus_points,
  });
}
