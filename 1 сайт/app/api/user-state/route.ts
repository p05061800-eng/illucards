import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { DeliveryCountry } from "@/app/lib/delivery";
import { normalizeDeliveryCountry } from "@/app/lib/delivery";
import { notifyTelegramWebhookUserState } from "@/app/lib/telegramStateBotSync";
import { findBotUserByUserId } from "@/app/lib/telegramBotUsersStore";
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
      ...(typeof x.frontImage === "string" ? { frontImage: x.frontImage } : {}),
      ...(typeof x.category === "string" ? { category: x.category } : {}),
      ...(Number.isFinite(Number(x.categoryOrder))
        ? { categoryOrder: Math.floor(Number(x.categoryOrder)) }
        : {}),
      ...(typeof x.rarity === "string" ? { rarity: x.rarity } : {}),
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
    const prevClearedAt =
      prev && typeof prev.cartClearedAt === "number" && Number.isFinite(prev.cartClearedAt)
        ? Math.floor(prev.cartClearedAt)
        : 0;
    const clearedSeenRaw = o.client_seen_cart_cleared_at;
    const clientClearedSeen =
      typeof clearedSeenRaw === "number" && Number.isFinite(clearedSeenRaw)
        ? Math.floor(clearedSeenRaw)
        : typeof clearedSeenRaw === "string"
          ? Math.floor(Number(clearedSeenRaw))
          : 0;
    const clientStaleVsServerEmpty =
      prevEmpty &&
      incoming.length > 0 &&
      ((prevTs > 0 && (!clientSeenOk || clientSeen < prevTs)) ||
        (prevClearedAt > 0 &&
          (clientClearedSeen <= 0 || clientClearedSeen < prevClearedAt)));
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
  });
  await notifyTelegramWebhookUserState({
    userId,
    cart: saved.cart,
    favorites: saved.favorites,
    deliveryCountry: saved.deliveryCountry,
  });
  return NextResponse.json({
    ok: true,
    updatedAt: saved.updatedAt,
  });
}

const EMPTY_STATE: SyncedUserState = {
  cart: [],
  favorites: [],
  deliveryCountry: null,
  updatedAt: 0,
};

async function stateWithTelegramUsername(
  userId: number,
  state: SyncedUserState | null,
): Promise<SyncedUserState & { telegram_username?: string }> {
  const base = state ?? EMPTY_STATE;
  const row = await findBotUserByUserId(userId);
  const username = row?.username?.replace(/^@/, "").trim();
  return username ? { ...base, telegram_username: username } : base;
}

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
    return NextResponse.json(await stateWithTelegramUsername(userId, state));
  }

  if (secret && token && token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (cookieUid != null) {
    const state = await getTelegramUserState(cookieUid);
    return NextResponse.json(await stateWithTelegramUsername(cookieUid, state));
  }

  if (!secret) {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json(EMPTY_STATE);
    }
    return NextResponse.json(
      { error: "Сервер: не настроен ILLUCARDS_USER_STATE_SYNC_SECRET" },
      { status: 503 },
    );
  }

  return NextResponse.json(EMPTY_STATE);
}
