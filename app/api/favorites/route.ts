import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_TELEGRAM_USER_ID } from "@/app/lib/telegramUserIdentity";
import { notifyTelegramWebhookUserState } from "@/app/lib/telegramStateBotSync";
import { getTelegramUserState, saveTelegramUserState } from "@/app/lib/telegramUserStateStore";

/** В памяти процесса (на serverless сбрасывается между инвокациями). */
let favoritesStore: string[] = [];

function parseUserId(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 1e12) return null;
  return Math.floor(n);
}

function parseFavoriteIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((x): x is string => typeof x === "string").slice(0, 500);
}

function requestUserId(request: NextRequest, body?: Record<string, unknown> | null): number | null {
  return (
    parseUserId(body?.user_id) ??
    parseUserId(body?.telegramUserId) ??
    parseUserId(request.nextUrl.searchParams.get("user_id")) ??
    parseUserId(request.cookies.get(COOKIE_TELEGRAM_USER_ID)?.value)
  );
}

export async function GET(request: NextRequest) {
  const userId = requestUserId(request);
  if (userId != null) {
    const state = await getTelegramUserState(userId);
    return NextResponse.json(state?.favorites ?? []);
  }
  return NextResponse.json(favoritesStore);
}

export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as unknown;
    const body = data && typeof data === "object" && !Array.isArray(data)
      ? data as Record<string, unknown>
      : null;
    const ids = parseFavoriteIds(body ? body.favorites : data);
    if (!ids) {
      return NextResponse.json({ error: "Expected JSON array" }, { status: 400 });
    }
    favoritesStore = ids;
    const userId = requestUserId(req, body);
    if (userId != null) {
      const prev = await getTelegramUserState(userId);
      if (ids.length === 0 && (prev?.favorites ?? []).length > 0 && body?.clear !== true) {
        return NextResponse.json({ ok: true, ignored_empty: true });
      }
      const saved = await saveTelegramUserState(userId, {
        cart: prev?.cart ?? [],
        favorites: ids,
        deliveryCountry: prev?.deliveryCountry ?? null,
        bonus_points: Math.max(0, Math.floor(prev?.bonus_points ?? 0)),
      });
      await notifyTelegramWebhookUserState({
        userId,
        cart: saved.cart,
        favorites: saved.favorites,
        deliveryCountry: saved.deliveryCountry,
        bonus_points: saved.bonus_points,
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
}
