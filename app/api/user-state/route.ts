import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getTelegramUserState,
  saveTelegramUserState,
  type SyncedCartItem,
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

function bearerToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

async function syncToTelegramBot(opts: {
  userId: number;
  cart: SyncedCartItem[];
  favorites: string[];
}): Promise<void> {
  const base = (process.env.TELEGRAM_SYNC_API_URL || "").trim().replace(/\/+$/, "");
  if (!base) return;
  const secret = (process.env.TELEGRAM_SYNC_API_SECRET || "").trim();
  try {
    await fetch(`${base}/api/sync/state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "X-Sync-Secret": secret } : {}),
      },
      body: JSON.stringify({
        user_id: opts.userId,
        cart: opts.cart.map((x) => ({
          ref: x.id,
          name: x.title,
          price: x.priceByn,
          qty: x.quantity,
        })),
        favorites: opts.favorites.map((id) => ({ ref: id })),
      }),
      cache: "no-store",
    });
  } catch {
    // Синхронизация в бот вторична и не должна ломать кабинет сайта.
  }
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

  const cart = parseCart(o.cart);
  const favorites = parseFavorites(o.favorites);
  await saveTelegramUserState(userId, { cart, favorites });
  await syncToTelegramBot({ userId, cart, favorites });
  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const secret = process.env.ILLUCARDS_USER_STATE_SYNC_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Сервер: не настроен ILLUCARDS_USER_STATE_SYNC_SECRET" },
      { status: 503 },
    );
  }
  const token = bearerToken(request);
  if (!token || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseUserId(request.nextUrl.searchParams.get("user_id"));
  if (userId == null) {
    return NextResponse.json({ error: "Некорректный user_id" }, { status: 400 });
  }
  const state = await getTelegramUserState(userId);
  return NextResponse.json(state ?? { cart: [], favorites: [], updatedAt: Date.now() });
}
