import { randomInt } from "crypto";
import { promises as fs } from "fs";
import path from "path";

const CODES_FILE = path.join(
  process.cwd(),
  "data",
  "telegram-login-codes.json",
);

const TTL_MS = 5 * 60 * 1000;
const TTL_SEC = Math.ceil(TTL_MS / 1000);

const REDIS_KEY = (code: string) => `illucards:lc:${code}`;
const REDIS_USER_KEY = (userId: number) => `illucards:lc:user:${userId}`;

export type LoginCodeEntry = {
  user_id: number;
  username_norm: string;
  username_display: string;
  expires: number;
};

export type LoginCodesFile = Record<string, LoginCodeEntry>;

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

function redisEnabled(): boolean {
  return redisRestCredentials() != null;
}

async function redisCommand(
  cmd: unknown[],
): Promise<{ result?: unknown; error?: string } | null> {
  const cred = redisRestCredentials();
  if (!cred) return null;
  const { url, token } = cred;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(cmd),
      cache: "no-store",
    });
    return (await res.json()) as { result?: unknown; error?: string };
  } catch {
    return null;
  }
}

async function redisGet(key: string): Promise<string | null> {
  const j = await redisCommand(["GET", key]);
  if (!j || j.error) return null;
  const r = j.result;
  if (typeof r !== "string") return null;
  return r;
}

async function redisDel(key: string): Promise<void> {
  await redisCommand(["DEL", key]);
}

async function redisSetEx(key: string, seconds: number, value: string): Promise<void> {
  await redisCommand(["SET", key, value, "EX", String(seconds)]);
}

async function readFile(): Promise<LoginCodesFile> {
  try {
    const raw = await fs.readFile(CODES_FILE, "utf-8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object" || Array.isArray(j)) return {};
    return j as LoginCodesFile;
  } catch {
    return {};
  }
}

function pruneExpired(data: LoginCodesFile): LoginCodesFile {
  const now = Date.now();
  const out: LoginCodesFile = {};
  for (const [code, row] of Object.entries(data)) {
    if (!row || typeof row.expires !== "number") continue;
    if (row.expires > now) out[code] = row;
  }
  return out;
}

function stripUserCodes(data: LoginCodesFile, userId: number): LoginCodesFile {
  const out: LoginCodesFile = {};
  for (const [code, row] of Object.entries(data)) {
    if (row.user_id !== userId) out[code] = row;
  }
  return out;
}

async function writeFile(data: LoginCodesFile): Promise<void> {
  await fs.mkdir(path.dirname(CODES_FILE), { recursive: true });
  await fs.writeFile(CODES_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/** Сохранить одноразовый код (Redis на Vercel или файл локально). */
export async function upsertLoginCodeEntry(
  code: string,
  entry: LoginCodeEntry,
): Promise<void> {
  if (redisEnabled()) {
    const old = await redisGet(REDIS_USER_KEY(entry.user_id));
    if (old && /^\d{4}$/.test(old)) {
      await redisDel(REDIS_KEY(old));
    }
    const payload = JSON.stringify(entry);
    await redisSetEx(REDIS_KEY(code), TTL_SEC, payload);
    await redisSetEx(REDIS_USER_KEY(entry.user_id), TTL_SEC, code);
    return;
  }

  let data = pruneExpired(await readFile());
  data = stripUserCodes(data, entry.user_id);
  data[code] = entry;
  await writeFile(data);
}

/** Выдать новый одноразовый код (старые коды этого user_id удаляются). */
export async function issueLoginCode(
  userId: number,
  usernameNorm: string,
  usernameDisplay: string,
): Promise<string> {
  const expires = Date.now() + TTL_MS;

  for (let attempt = 0; attempt < 50; attempt++) {
    const code = String(randomInt(0, 10_000)).padStart(4, "0");
    if (redisEnabled()) {
      const existing = await redisGet(REDIS_KEY(code));
      if (existing) continue;
    } else {
      const data = pruneExpired(await readFile());
      if (data[code]) continue;
    }
    await upsertLoginCodeEntry(code, {
      user_id: userId,
      username_norm: usernameNorm,
      username_display: usernameDisplay,
      expires,
    });
    return code;
  }
  throw new Error("Не удалось сгенерировать код");
}

/** Проверить код; при успехе удалить запись и вернуть данные. */
export async function consumeLoginCode(
  usernameNorm: string,
  codeRaw: string,
): Promise<{ user_id: number; username: string } | null> {
  const digits = codeRaw.replace(/\D/g, "");
  if (digits.length !== 4) return null;
  const code = digits;

  if (redisEnabled()) {
    const raw = await redisGet(REDIS_KEY(code));
    if (!raw) return null;
    let row: LoginCodeEntry;
    try {
      row = JSON.parse(raw) as LoginCodeEntry;
    } catch {
      await redisDel(REDIS_KEY(code));
      return null;
    }
    if (Date.now() > row.expires) {
      await redisDel(REDIS_KEY(code));
      await redisDel(REDIS_USER_KEY(row.user_id));
      return null;
    }
    if (row.username_norm !== usernameNorm) {
      return null;
    }
    await redisDel(REDIS_KEY(code));
    await redisDel(REDIS_USER_KEY(row.user_id));
    return {
      user_id: row.user_id,
      username: row.username_display,
    };
  }

  const data = pruneExpired(await readFile());
  const row = data[code];
  if (!row) return null;
  if (Date.now() > row.expires) {
    delete data[code];
    await writeFile(data);
    return null;
  }
  if (row.username_norm !== usernameNorm) {
    return null;
  }

  delete data[code];
  await writeFile(data);
  return {
    user_id: row.user_id,
    username: row.username_display,
  };
}

/** Проверить код без username; при успехе удалить запись и вернуть данные. */
export async function consumeLoginCodeByCode(
  codeRaw: string,
): Promise<{ user_id: number; username: string } | null> {
  const digits = codeRaw.replace(/\D/g, "");
  if (digits.length !== 4) return null;
  const code = digits;

  if (redisEnabled()) {
    const raw = await redisGet(REDIS_KEY(code));
    if (!raw) return null;
    let row: LoginCodeEntry;
    try {
      row = JSON.parse(raw) as LoginCodeEntry;
    } catch {
      await redisDel(REDIS_KEY(code));
      return null;
    }
    if (Date.now() > row.expires) {
      await redisDel(REDIS_KEY(code));
      await redisDel(REDIS_USER_KEY(row.user_id));
      return null;
    }
    await redisDel(REDIS_KEY(code));
    await redisDel(REDIS_USER_KEY(row.user_id));
    return {
      user_id: row.user_id,
      username: row.username_display,
    };
  }

  const data = pruneExpired(await readFile());
  const row = data[code];
  if (!row) return null;
  if (Date.now() > row.expires) {
    delete data[code];
    await writeFile(data);
    return null;
  }

  delete data[code];
  await writeFile(data);
  return {
    user_id: row.user_id,
    username: row.username_display,
  };
}
