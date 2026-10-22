const REDIS_CARDS_KEY = "illucards:catalog:cards";
const REDIS_CATEGORIES_KEY = "illucards:catalog:categories";
const REDIS_MENU_KEY = "illucards:catalog:menu";
const REDIS_SOCIAL_KEY = "illucards:catalog:social-links";
const REDIS_PROMO_KEY = "illucards:catalog:promo-slides";

function redisRestCredentials(): { url: string; token: string } | null {
const u =
  process.env.UPSTASH_REDIS_REST_URL?.trim() ||
  process.env.KV_REST_API_URL?.trim() ||
  process.env.UPSTASH_REDIS_REST_KV_REST_API_URL?.trim();

const t =
  process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
  process.env.KV_REST_API_TOKEN?.trim() ||
  process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN?.trim();
  if (!u || !t) return null;
  return { url: u, token: t };
}

async function redisCommand(
  cmd: unknown[],
): Promise<{ result?: unknown; error?: string } | null> {
  const cred = redisRestCredentials();

  if (!cred) {
    console.error("Redis REST credentials are missing.");
    return null;
  }

  try {
    const res = await fetch(cred.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cred.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cmd),
      cache: "no-store",
    });

    const body = (await res.json()) as {
      result?: unknown;
      error?: string;
    };

    if (!res.ok || body.error) {
      console.error(
        `Upstash Redis HTTP ${res.status}:`,
        body.error ?? "Unknown error",
      );
    }

    return body;
  } catch (error) {
    console.error(
      "Upstash Redis request failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

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

const REDIS_UPLOAD_PREFIX = "illucards:upload:";

export function sanitizeUploadRelativePath(relativePath: string): string | null {
  const s = relativePath.trim().replace(/^\/+/, "");
  if (!s || s.includes("..") || s.includes("\\")) return null;
  if (!/^[a-zA-Z0-9._/-]+$/.test(s)) return null;
  return s;
}

async function writeFileBinary(filePath: string, bytes: Buffer): Promise<boolean> {
  try {
    const { promises: fs } = await import("fs");
    const path = await import("path");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, bytes);
    return true;
  } catch {
    return false;
  }
}

async function readFileBinary(filePath: string): Promise<Buffer | null> {
  try {
    const { promises: fs } = await import("fs");
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

/** Сначала Vercel Blob (прод), иначе Redis/диск. */
export async function savePublicUpload(
  relativePath: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  try {
    const { put } = await import("@vercel/blob");
    const blob = await put(relativePath, bytes, {
      access: "public",
      addRandomSuffix: false,
      contentType,
      cacheControlMaxAge: 31536000,
    });
    if (blob.url) return blob.url;
  } catch {
    /* нет BLOB_READ_WRITE_TOKEN или Blob недоступен — запасной путь */
  }
  return saveDurableUpload(relativePath, bytes);
}

/** Сохраняет файл загрузки: Redis (прод) и/или public/uploads (локально). */
export async function saveDurableUpload(
  relativePath: string,
  bytes: Buffer,
): Promise<string> {
  const safe = sanitizeUploadRelativePath(relativePath);
  if (!safe) {
    throw new Error("Некорректное имя файла загрузки.");
  }
  const b64 = bytes.toString("base64");
  /** Бесплатный Upstash REST обычно режет тело ~1 МБ — тогда остаётся только диск (локально). */
  const redisOk =
    b64.length <= 900_000
      ? await redisSetText(REDIS_UPLOAD_PREFIX + safe, b64)
      : false;
  const path = await import("path");
  const diskPath = path.join(process.cwd(), "public", "uploads", safe);
  const fileOk = await writeFileBinary(diskPath, bytes);
  if (!redisOk && !fileOk) {
    throw new Error(
      b64.length > 900_000
        ? "Файл слишком большой для хранения на сайте. Сожмите изображение (JPG/PNG до ~600 КБ) и попробуйте снова."
        : "Не удалось сохранить изображение на сервере. На Vercel нужен Redis (UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN).",
    );
  }
  return `/api/media/${safe}`;
}

export async function loadDurableUpload(
  relativePath: string,
): Promise<Buffer | null> {
  const safe = sanitizeUploadRelativePath(relativePath);
  if (!safe) return null;
  const b64 = await redisGetText(REDIS_UPLOAD_PREFIX + safe);
  if (b64) {
    try {
      return Buffer.from(b64, "base64");
    } catch {
      /* fall through to disk */
    }
  }
  const path = await import("path");
  return readFileBinary(path.join(process.cwd(), "public", "uploads", safe));
}
