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
    const token = decodeURIComponent(parsed.password || "");
    const host = parsed.hostname.trim();
    if (!host || !token) return null;
    return { url: `https://${host}`, token };
  } catch {
    return null;
  }
}

export function presentRedisEnvNames(): string[] {
  return ALL_REDIS_ENV_KEYS.filter((key) => Boolean(process.env[key]?.trim()));
}

export function redisRestCredentials(): { url: string; token: string } | null {
  const httpUrl = firstEnv(REST_URL_KEYS);
  const token = firstEnv(REST_TOKEN_KEYS);
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
  return `Redis REST не распознан (есть ${present.join(", ")}). Нужны UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN или REDIS_URL вида rediss://default:TOKEN@….upstash.io:6379.`;
}

export async function redisCommand(
  cmd: unknown[],
): Promise<{ result?: unknown; error?: string } | null> {
  const cred = redisRestCredentials();
  if (!cred) {
    console.error("Redis REST credentials are missing.", presentRedisEnvNames());
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

export async function redisGetText(key: string): Promise<string | null> {
  const j = await redisCommand(["GET", key]);
  if (!j || j.error || typeof j.result !== "string" || !j.result.trim()) {
    return null;
  }
  return j.result;
}

export async function redisSetText(key: string, value: string): Promise<boolean> {
  const j = await redisCommand(["SET", key, value]);
  if (!j || j.error) return false;
  return j.result === "OK" || j.result === true;
}
