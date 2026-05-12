import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { DeliveryCountry } from "@/app/lib/delivery";
import { normalizeDeliveryCountry } from "@/app/lib/delivery";
import { notifyTelegramWebhookUserState } from "@/app/lib/telegramStateBotSync";
import {
  getTelegramUserState,
  saveTelegramUserState,
  type SyncedCartItem,
  type SyncedUserState,
} from "@/app/lib/telegramUserStateStore";
import { COOKIE_TELEGRAM_USER_ID } from "@/app/lib/telegramUserIdentity";

function parseUserId(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 1e12) return null;
  return Math.floor(n);
}

function parseCart(raw: unknown): SyncedCartItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      id: typeof x.id === "string" ? x.id : "",
      title: typeof x.title === "string" ? x.title : "",
      quantity: Number(x.quantity),
      priceByn: Number(x.priceByn),
      priceRub: Number(x.priceRub),
    }))
    .filter((x) => x.id.length > 0);
}

function parseFavorites(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

function parseDeliveryCountryField(raw: unknown): DeliveryCountry | null {
  return normalizeDeliveryCountry(raw);
}

function parseBonusPoints(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1e9) return null;
  return Math.floor(n);
}

function firstBonusNumber(o: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if (!(key in o)) continue;
    const n = parseBonusPoints(o[key]);
    if (n !== null) return n;
  }
  return null;
}

function bearerToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

export async function POST(request: NextRequest) {
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

  const cookieUid = parseUserId(request.cookies.get(COOKIE_TELEGRAM_USER_ID)?.value);
  if (cookieUid == null || cookieUid !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prev = await getTelegramUserState(userId);
  let cart = prev?.cart ?? [];
  let favorites = prev?.favorites ?? [];
  let deliveryCountry: DeliveryCountry | null = prev?.deliveryCountry ?? null;
  const prevBonusPoints = Math.max(0, Math.floor(prev?.bonus_points ?? 0));
  const bonusBalance = firstBonusNumber(o, [
    "bonus_points",
    "bonusPoints",
    "bonusBalance",
    "bonus_balance",
    "loyaltyPoints",
    "loyaltyBalance",
    "pointsBalance",
  ]);
  const bonusEarned = firstBonusNumber(o, [
    "bonusEarned",
    "bonus_earned",
    "pointsEarned",
    "loyaltyEarned",
    "earnedBonus",
    "bonusesAdded",
    "orderBonusEarned",
  ]);
  let bonus_points = bonusBalance ?? prevBonusPoints;
  if (bonusBalance === null && bonusEarned !== null && bonusEarned > 0) {
    bonus_points = Math.min(1_000_000_000, prevBonusPoints + bonusEarned);
  }
  if ("cart" in o) {
    let incoming = parseCart(o.cart);
    const explicitClearCart = o.clear_cart === true || o.cart_clear === true;
    const seenRaw = o.client_seen_updated_at;
    const clientSeen =
      typeof seenRaw === "number" && Number.isFinite(seenRaw)
        ? seenRaw
        : typeof seenRaw === "string"
          ? Number(seenRaw)
          : NaN;
    const clientSeenOk = Number.isFinite(clientSeen) && clientSeen > 0;
    const prevEmpty = (prev?.cart ?? []).length === 0;
    const prevTs =
      prev && typeof prev.updatedAt === "number" && Number.isFinite(prev.updatedAt)
        ? prev.updatedAt
        : 0;
    /** Сервер очистил корзину новее, чем знает клиент — не затирать пустую корзину старым localStorage. */
    const clientStaleVsServerEmpty =
      prevEmpty && incoming.length > 0 && prevTs > 0 && (!clientSeenOk || clientSeen <= prevTs);
    if (clientStaleVsServerEmpty) {
      incoming = [];
    }
    if (incoming.length > 0 || (prev?.cart ?? []).length === 0 || explicitClearCart) {
      cart = incoming;
    }
  }
  if ("favorites" in o) {
    const incomingFavorites = parseFavorites(o.favorites);
    const explicitClearFavorites =
      o.clear_favorites === true || o.favorites_clear === true;
    if (
      incomingFavorites.length > 0 ||
      (prev?.favorites ?? []).length === 0 ||
      explicitClearFavorites
    ) {
      favorites = incomingFavorites;
    }
  }
  if ("delivery_country" in o) {
    if (o.delivery_country === null) {
      deliveryCountry = null;
    } else {
      const p = parseDeliveryCountryField(o.delivery_country);
      if (p !== null) deliveryCountry = p;
    }
  }
  const saved = await saveTelegramUserState(userId, {
    cart,
    favorites,
    deliveryCountry,
    bonus_points,
  });
  await notifyTelegramWebhookUserState({
    userId,
    cart: saved.cart,
    favorites: saved.favorites,
    deliveryCountry: saved.deliveryCountry,
    bonus_points: saved.bonus_points,
    ...(bonusEarned !== null && bonusEarned > 0 ? { bonusEarned } : {}),
  });
  return NextResponse.json({
    ok: true,
    updatedAt: saved.updatedAt,
    bonus_points: saved.bonus_points,
  });
}

const EMPTY_STATE: SyncedUserState = {
  cart: [],
  favorites: [],
  deliveryCountry: null,
  bonus_points: 0,
  updatedAt: 0,
};

export async function GET(request: NextRequest) {
  const secret = (process.env.ILLUCARDS_USER_STATE_SYNC_SECRET || "").trim();
  const token = bearerToken(request);
  const cookieUid = parseUserId(request.cookies.get(COOKIE_TELEGRAM_USER_ID)?.value);

  if (secret && token === secret) {
    const userId = parseUserId(request.nextUrl.searchParams.get("user_id"));
    if (userId == null) {
      return NextResponse.json({ error: "Некорректный user_id" }, { status: 400 });
    }
    const state = await getTelegramUserState(userId);
    return NextResponse.json(state ?? EMPTY_STATE);
  }

  if (cookieUid != null) {
    const state = await getTelegramUserState(cookieUid);
    return NextResponse.json(state ?? EMPTY_STATE);
  }

  if (!secret) {
    return NextResponse.json(
      { error: "Сервер: не настроен ILLUCARDS_USER_STATE_SYNC_SECRET" },
      { status: 503 },
    );
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
