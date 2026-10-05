const REDIS_CARDS_KEY = "illucards:catalog:cards";
const REDIS_CATEGORIES_KEY = "illucards:catalog:categories";
const REDIS_MENU_KEY = "illucards:catalog:menu";
const REDIS_SOCIAL_KEY = "illucards:catalog:social-links";
const REDIS_PROMO_KEY = "illucards:catalog:promo-slides";

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

async function redisGetText(key: string): Promise<string | null> {
  const j = await redisCommand(["GET", key]);
  if (!j || j.error || typeof j.result !== "string" || !j.result.trim()) {
    return null;
  }
  return j.result;
}

async function redisSetText(key: string, value: string): Promise<boolean> {
  const j = await redisCommand(["SET", key, value]);
  if (!j || j.error) return false;
  return j.result === "OK" || j.result === true;
}

async function readFileText(filePath: string): Promise<string | null> {
  try {
    const { promises: fs } = await import("fs");
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

async function writeFileText(filePath: string, text: string): Promise<boolean> {
  try {
    const { promises: fs } = await import("fs");
    const path = await import("path");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, text, "utf-8");
    return true;
  } catch {
    return false;
  }
}

export async function loadDurableJsonText(
  redisKey: string,
  filePath: string,
): Promise<string | null> {
  const fromRedis = await redisGetText(redisKey);
  if (fromRedis) return fromRedis;
  return readFileText(filePath);
}

export async function saveDurableJsonText(
  redisKey: string,
  filePath: string,
  text: string,
): Promise<void> {
  const redisOk = await redisSetText(redisKey, text);
  const fileOk = await writeFileText(filePath, text);
  if (redisOk || fileOk) return;
  throw new Error(
    "Не удалось сохранить на сервере. На Vercel нужен Redis (UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN) — диск там нельзя менять.",
  );
}

export const DURABLE_JSON_KEYS = {
  cards: REDIS_CARDS_KEY,
  categories: REDIS_CATEGORIES_KEY,
  menu: REDIS_MENU_KEY,
  social: REDIS_SOCIAL_KEY,
  promo: REDIS_PROMO_KEY,
} as const;
