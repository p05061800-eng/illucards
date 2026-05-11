import { NextResponse } from "next/server";
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

export async function GET() {
  return NextResponse.json(favoritesStore);
}

export async function POST(req: Request) {
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
    const userId = parseUserId(body?.user_id);
    if (userId != null) {
      const prev = await getTelegramUserState(userId);
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
