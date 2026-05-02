import { promises as fs } from "fs";
import path from "path";
import type { DeliveryCountry } from "@/app/lib/delivery";

const STORE_FILE = path.join(process.cwd(), "data", "telegram-user-state.json");
const REDIS_KEY = (userId: number) => `illucards:user-state:${userId}`;
const TTL_SEC = 60 * 60 * 24 * 30;

export type SyncedCartItem = {
  id: string;
  title: string;
  quantity: number;
  priceByn: number;
  priceRub: number;
};

export type SyncedUserState = {
  favorites: string[];
  cart: SyncedCartItem[];
  /** Страна доставки с сайта — для цен в боте (BY → BYN, иначе RUB). */
  deliveryCountry: DeliveryCountry | null;
  /** Бонусные баллы (начисление за доставленные заказы, списание в корзине). */
  bonus_points: number;
  updatedAt: number;
};

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

function parseDeliveryCountry(v: unknown): DeliveryCountry | null {
  if (v === "BY" || v === "RU" || v === "UA" || v === "OTHER") return v;
  return null;
}

function sanitize(data: Partial<SyncedUserState>): SyncedUserState {
  const favorites = Array.isArray(data.favorites)
    ? data.favorites.filter((x): x is string => typeof x === "string").slice(0, 500)
    : [];
  const cart = Array.isArray(data.cart)
    ? data.cart
        .filter((x): x is SyncedCartItem => !!x && typeof x === "object")
        .map((x) => ({
          id: typeof x.id === "string" ? x.id.slice(0, 120) : "",
          title: typeof x.title === "string" ? x.title.slice(0, 300) : "",
          quantity: Math.max(1, Math.min(99, Math.floor(Number(x.quantity) || 1))),
          priceByn: Number.isFinite(Number(x.priceByn)) ? Number(x.priceByn) : 0,
          priceRub: Number.isFinite(Number(x.priceRub)) ? Number(x.priceRub) : 0,
        }))
        .filter((x) => x.id.length > 0)
        .slice(0, 200)
    : [];
  const bpRaw = (data as Record<string, unknown>).bonus_points;
  const bonus_points =
    typeof bpRaw === "number" && Number.isFinite(bpRaw) && bpRaw >= 0 && bpRaw <= 1e9
      ? Math.floor(bpRaw)
      : 0;

  return {
    favorites,
    cart,
    deliveryCountry: parseDeliveryCountry(data.deliveryCountry),
    bonus_points,
    updatedAt:
      typeof data.updatedAt === "number" && Number.isFinite(data.updatedAt)
        ? data.updatedAt
        : Date.now(),
  };
}

async function readFileStore(): Promise<Record<string, SyncedUserState>> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf-8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object" || Array.isArray(j)) return {};
    return j as Record<string, SyncedUserState>;
  } catch {
    return {};
  }
}

async function writeFileStore(data: Record<string, SyncedUserState>): Promise<void> {
  await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function saveTelegramUserState(
  userId: number,
  nextState: Partial<SyncedUserState>,
): Promise<SyncedUserState> {
  const prev = await getTelegramUserState(userId);
  const merged: Partial<SyncedUserState> = {
    favorites: nextState.favorites ?? prev?.favorites ?? [],
    cart: nextState.cart ?? prev?.cart ?? [],
    deliveryCountry:
      "deliveryCountry" in nextState
        ? (nextState.deliveryCountry ?? null)
        : (prev?.deliveryCountry ?? null),
    bonus_points:
      "bonus_points" in nextState
        ? Math.max(0, Math.floor(Number(nextState.bonus_points) || 0))
        : Math.max(0, Math.floor(prev?.bonus_points ?? 0)),
  };
  const state = sanitize(merged);

  const j = await redisCommand([
    "SET",
    REDIS_KEY(userId),
    JSON.stringify(state),
    "EX",
    String(TTL_SEC),
  ]);
  if (j && !j.error) return state;

  const data = await readFileStore();
  data[String(userId)] = state;
  await writeFileStore(data);
  return state;
}

/** Пустая корзина на сервере, избранное и доставка сохраняются. */
export async function clearSyncedCartForTelegramUser(
  userId: number,
): Promise<SyncedUserState> {
  if (!Number.isFinite(userId) || userId <= 0) {
    return sanitize({ cart: [], favorites: [], deliveryCountry: null, bonus_points: 0 });
  }
  const prev = await getTelegramUserState(userId);
  return saveTelegramUserState(userId, {
    cart: [],
    favorites: prev?.favorites ?? [],
    deliveryCountry: prev?.deliveryCountry ?? null,
    bonus_points: Math.max(0, Math.floor(prev?.bonus_points ?? 0)),
  });
}

export async function incrementTelegramUserBonusPoints(
  userId: number,
  delta: number,
): Promise<SyncedUserState> {
  const prev = await getTelegramUserState(userId);
  const cur = Math.max(0, Math.floor(prev?.bonus_points ?? 0));
  const next = Math.min(1_000_000_000, Math.max(0, cur + Math.floor(delta)));
  return saveTelegramUserState(userId, {
    cart: prev?.cart ?? [],
    favorites: prev?.favorites ?? [],
    deliveryCountry: prev?.deliveryCountry ?? null,
    bonus_points: next,
  });
}

/**
 * Списать баллы (уже проверенные). Возвращает false, если на счёте меньше, чем spend.
 */
export async function trySpendTelegramUserBonusPoints(
  userId: number,
  spend: number,
): Promise<{ ok: true; state: SyncedUserState } | { ok: false }> {
  const prev = await getTelegramUserState(userId);
  const cur = Math.max(0, Math.floor(prev?.bonus_points ?? 0));
  const s = Math.max(0, Math.floor(spend));
  if (s > cur) return { ok: false };
  const state = await saveTelegramUserState(userId, {
    cart: prev?.cart ?? [],
    favorites: prev?.favorites ?? [],
    deliveryCountry: prev?.deliveryCountry ?? null,
    bonus_points: cur - s,
  });
  return { ok: true, state };
}

export async function getTelegramUserState(
  userId: number,
): Promise<SyncedUserState | null> {
  const j = await redisCommand(["GET", REDIS_KEY(userId)]);
  if (j && !j.error && typeof j.result === "string") {
    try {
      return sanitize(JSON.parse(j.result) as Partial<SyncedUserState>);
    } catch {
      /* Redis мог содержать битый JSON — читаем файл */
    }
  }

  const data = await readFileStore();
  const row = data[String(userId)];
  if (!row) return null;
  return sanitize(row);
}
