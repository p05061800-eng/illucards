import { promises as fs } from "fs";
import path from "path";

const STORE_FILE = path.join(
  process.cwd(),
  "data",
  "saved-delivery-profiles.json",
);

const MAX_TEXT_LEN = 2000;
const REDIS_KEY = (userId: number) => `illucards:delivery:${userId}`;

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

function sanitizeText(raw: unknown): string | null {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t || t.length < 12 || t.length > MAX_TEXT_LEN) return null;
  return t;
}

async function readFileStore(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf-8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object" || Array.isArray(j)) return {};
    return j as Record<string, string>;
  } catch {
    return {};
  }
}

async function writeFileStore(data: Record<string, string>): Promise<void> {
  try {
    await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
    await fs.writeFile(STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    /* ignore on serverless */
  }
}

export async function getSavedDeliveryText(
  userId: number,
): Promise<string | null> {
  const uid = Math.floor(userId);
  if (!Number.isFinite(uid) || uid <= 0) return null;

  const j = await redisCommand(["GET", REDIS_KEY(uid)]);
  if (j && !j.error && typeof j.result === "string") {
    const t = sanitizeText(j.result);
    if (t) return t;
  }

  const file = await readFileStore();
  const t = sanitizeText(file[String(uid)]);
  return t;
}

export async function setSavedDeliveryText(
  userId: number,
  text: string,
): Promise<boolean> {
  const uid = Math.floor(userId);
  const t = sanitizeText(text);
  if (!Number.isFinite(uid) || uid <= 0 || !t) return false;

  const j = await redisCommand(["SET", REDIS_KEY(uid), t]);
  if (j && !j.error) {
    return true;
  }

  const file = await readFileStore();
  file[String(uid)] = t;
  await writeFileStore(file);
  return true;
}
