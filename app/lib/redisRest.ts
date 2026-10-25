const REST_URL_KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "KV_REST_API_URL",
  "UPSTASH_REDIS_REST_KV_REST_API_URL",
  "STORAGE_REST_URL",
] as const;

const REST_TOKEN_KEYS = [
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_KV_REST_API_TOKEN",
  "STORAGE_REST_TOKEN",
] as const;

const TCP_URL_KEYS = [
  "REDIS_URL",
  "KV_URL",
  "UPSTASH_REDIS_URL",
  "STORAGE_URL",
] as const;

const ALL_REDIS_ENV_KEYS = [
  ...REST_URL_KEYS,
  ...REST_TOKEN_KEYS,
  ...TCP_URL_KEYS,
] as const;

function firstEnv(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function tokenFromRedisUrl(raw: string): string | undefined {
  try {
    const parsed = new URL(raw);
    const password = decodeURIComponent(parsed.password || "");
    const username = decodeURIComponent(parsed.username || "");
    if (password) return password;
    if (username && username !== "default") return username;
  } catch {
    /* ignore */
  }
  return undefined;
}

function credentialsFromHttp(
  url: string,
  token: string | undefined,
): { url: string; token: string } | null {
  if (!token || !/^https?:\/\//i.test(url)) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

/** Vercel Redis / Upstash часто даёт только `rediss://default:TOKEN@host:6379`. */
function credentialsFromRedisUrl(
  raw: string,
): { url: string; token: string } | null {
  try {
    const parsed = new URL(raw);
    if (!/^rediss?:$/i.test(parsed.protocol)) return null;
    const token = tokenFromRedisUrl(raw);
    const host = parsed.hostname.trim();
    if (!host || !token) return null;
    return { url: `https://${host}`, token };
  } catch {
    return null;
  }
}

function tokenFromAnyTcpEnv(): string | undefined {
  for (const key of TCP_URL_KEYS) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    const token = tokenFromRedisUrl(raw);
    if (token) return token;
  }
  return undefined;
}

export function presentRedisEnvNames(): string[] {
  return ALL_REDIS_ENV_KEYS.filter((key) => Boolean(process.env[key]?.trim()));
}

export function redisRestCredentials(): { url: string; token: string } | null {
  const httpUrl = firstEnv(REST_URL_KEYS);
  const token = firstEnv(REST_TOKEN_KEYS) || tokenFromAnyTcpEnv();
  if (httpUrl) {
    const fromHttp = credentialsFromHttp(httpUrl, token);
    if (fromHttp) return fromHttp;
    const fromMislabelled = credentialsFromRedisUrl(httpUrl);
    if (fromMislabelled) return fromMislabelled;
  }
  for (const key of TCP_URL_KEYS) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    const fromTcp = credentialsFromRedisUrl(raw);
    if (fromTcp) return fromTcp;
    const fromHttpTcp = credentialsFromHttp(raw, token);
    if (fromHttpTcp) return fromHttpTcp;
  }
  return null;
}

export function redisCredentialsHint(): string {
  const present = presentRedisEnvNames();
  if (redisRestCredentials()) {
    return "Redis подключён.";
  }
  if (present.length === 0) {
    return "Redis не виден в этом деплое. В Vercel → Storage привяжите Redis к Production и сделайте Redeploy.";
  }
  return `Redis REST не распознан (есть ${present.join(", ")}). Нужны UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (https://….upstash.io), не только REDIS_URL.`;
}

type RedisBody = { result?: unknown; error?: string };

function isSetOk(result: unknown): boolean {
  if (result === "OK" || result === "ok" || result === true) return true;
  if (Array.isArray(result) && result.length > 0) return isSetOk(result[0]);
  return false;
}

async function parseRedisResponse(
  res: Response,
): Promise<RedisBody> {
  const text = await res.text();
  if (!text.trim()) {
    return { error: `HTTP ${res.status}, пустой ответ` };
  }
  try {
    return JSON.parse(text) as RedisBody;
  } catch {
    return {
      error: `HTTP ${res.status}: ${text.slice(0, 180)}`,
    };
  }
}

async function postRedis(
  url: string,
  token: string,
  payload: unknown,
  cacheMode: "no-store" | "catalog" = "no-store",
  timeoutMs?: number,
): Promise<{ status: number; body: RedisBody }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal:
      timeoutMs && timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined,
    ...(cacheMode === "catalog"
      ? { next: { revalidate: 60, tags: ["catalog-json"] } }
      : { cache: "no-store" as const }),
  });
  const body = await parseRedisResponse(res);
  if (!res.ok && !body.error) {
    body.error = `HTTP ${res.status}`;
  }
  return { status: res.status, body };
}

export async function redisCommand(
  cmd: unknown[],
  cacheMode: "no-store" | "catalog" = "no-store",
): Promise<{ result?: unknown; error?: string } | null> {
  const cred = redisRestCredentials();
  if (!cred) {
    /* Локально Redis не задан — каталог и админка читают git-файлы. */
    return null;
  }

  const catalogFast = cacheMode === "catalog";
  const timeoutMs = catalogFast ? 400 : undefined;

  try {
    const attempts: { url: string; payload: unknown }[] = catalogFast
      ? [{ url: cred.url, payload: cmd }]
      : [
          { url: cred.url, payload: cmd },
          { url: cred.url, payload: [cmd] },
          { url: `${cred.url}/pipeline`, payload: [cmd] },
        ];
    let last: { status: number; body: RedisBody } | null = null;
    for (const attempt of attempts) {
      last = await postRedis(
        attempt.url,
        cred.token,
        attempt.payload,
        cacheMode,
        timeoutMs,
      );
      if (!last.body.error && last.status >= 200 && last.status < 300) {
        return last.body;
      }
    }
    if (last) {
      console.error(
        `Upstash Redis HTTP ${last.status}:`,
        last.body.error ?? "Unknown error",
      );
      return last.body;
    }
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      return null;
    }
    console.error("Upstash Redis request failed:", message);
    return { error: message };
  }
}

export async function redisGetText(
  key: string,
  cacheMode: "no-store" | "catalog" = "no-store",
): Promise<string | null> {
  const j = await redisCommand(["GET", key], cacheMode);
  if (!j || j.error) return null;
  if (typeof j.result === "string" && j.result.trim()) return j.result;
  if (j.result && typeof j.result === "object") {
    try {
      return JSON.stringify(j.result);
    } catch {
      return null;
    }
  }
  return null;
}

export async function redisSetTextResult(
  key: string,
  value: string,
): Promise<{ ok: boolean; error?: string }> {
  const j = await redisCommand(["SET", key, value]);
  if (!j) {
    return {
      ok: false,
      error:
        "Нет ответа от Redis. Нужны UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN в Production.",
    };
  }
  if (j.error) {
    const err = j.error.toLowerCase();
    if (err.includes("401") || err.includes("403") || err.includes("auth") || err.includes("token")) {
      return {
        ok: false,
        error:
          "Redis отклонил ключ (нет прав на запись). В Vercel → Storage откройте Redis и проверьте REST Token для Production — не read-only.",
      };
    }
    return { ok: false, error: `Redis: ${j.error}` };
  }
  if (isSetOk(j.result)) return { ok: true };
  return {
    ok: false,
    error: `Redis не подтвердил SET (ответ: ${String(j.result).slice(0, 80)}).`,
  };
}

export async function redisSetText(key: string, value: string): Promise<boolean> {
  const r = await redisSetTextResult(key, value);
  return r.ok;
}
