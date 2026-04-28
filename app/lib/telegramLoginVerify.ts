import crypto from "node:crypto";
import type { TelegramVerifiedProfile } from "@/app/lib/telegramAuth";

const MAX_AUTH_AGE_SEC = 86400;

/**
 * 4. Secret key: `SHA-256` от `BOT_TOKEN` (32 байта, бинарный).
 * 5. `HMAC-SHA256(secret_key, data_check_string)` → hex.
 */
function telegramLoginSecretKey(botToken: string): Buffer {
  return crypto.createHash("sha256").update(botToken, "utf8").digest();
}

function computeTelegramLoginHmacHex(
  secretKey: Buffer,
  dataCheckString: string,
): string {
  return crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString, "utf8")
    .digest("hex");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * 1. Убрать `hash` из данных.
 * 2. Отсортировать поля по имени (алфавит).
 * 3. Собрать строку: для каждого поля `key=value`, между полями `\n` (LF).
 */
function buildDataCheckStringFromFieldMap(
  fieldMap: Map<string, string>,
): string {
  const keys = [...fieldMap.keys()].sort((a, b) => a.localeCompare(b));
  return keys.map((k) => `${k}=${fieldMap.get(k)!}`).join("\n");
}

/**
 * Сборка data-check string из плоского объекта (например JSON с виджета, POST).
 */
function buildDataCheckStringFromRecord(
  data: Record<string, unknown>,
  options: { trimValues: boolean },
): string {
  const fieldMap = new Map<string, string>();
  for (const key of Object.keys(data)) {
    if (key === "hash") continue;
    const val = data[key];
    if (val === undefined || val === null) continue;
    let s: string;
    if (typeof val === "number" && Number.isFinite(val)) {
      s = String(val);
    } else {
      s = String(val);
      if (options.trimValues) s = s.trim();
    }
    if (s === "") continue;
    fieldMap.set(key, s);
  }
  return buildDataCheckStringFromFieldMap(fieldMap);
}

/**
 * Сборка data-check string из query (GET редирект виджета) — значения **как в URL**, без изменений.
 */
export function buildTelegramDataCheckStringFromSearchParams(
  searchParams: URLSearchParams,
): string {
  const fieldMap = new Map<string, string>();
  searchParams.forEach((value, key) => {
    if (key === "hash") return;
    fieldMap.set(key, value);
  });
  return buildDataCheckStringFromFieldMap(fieldMap);
}

/**
 * 6. Сравнить HMAC (hex) с переданным `hash` (побайтово, timing-safe).
 */
function verifyHmacAgainstHash(
  botToken: string,
  dataCheckString: string,
  receivedHashHex: string,
): boolean {
  const secretKey = telegramLoginSecretKey(botToken);
  const hmacHex = computeTelegramLoginHmacHex(secretKey, dataCheckString);
  return timingSafeEqualHex(hmacHex, receivedHashHex);
}

/**
 * Проверка GET `/api/auth/telegram` (query string от Telegram).
 * @see https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramWidgetFromSearchParams(
  botToken: string,
  searchParams: URLSearchParams,
): boolean {
  const receivedHash = searchParams.get("hash");
  if (!receivedHash) return false;

  const authDateRaw = searchParams.get("auth_date");
  if (authDateRaw == null) return false;
  const ts = Number(authDateRaw);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (now - ts > MAX_AUTH_AGE_SEC || ts - now > 60) {
    return false;
  }

  const dataCheckString = buildTelegramDataCheckStringFromSearchParams(
    searchParams,
  );
  return verifyHmacAgainstHash(botToken, dataCheckString, receivedHash);
}

/**
 * Проверка POST (JSON с callback-виджета / клиента).
 * Для JSON поля `id` и `auth_date` — как числа, остальное — строка с trim.
 */
export function verifyTelegramWidgetHash(
  botToken: string,
  data: Record<string, unknown>,
): boolean {
  const receivedHash = data.hash;
  if (typeof receivedHash !== "string" || !receivedHash) return false;

  const authDate = data.auth_date;
  if (typeof authDate !== "number" && typeof authDate !== "string") {
    return false;
  }
  const ts = Number(authDate);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (now - ts > MAX_AUTH_AGE_SEC || ts - now > 60) {
    return false;
  }

  const dataCheckString = buildDataCheckStringFromRecord(data, {
    trimValues: true,
  });
  return verifyHmacAgainstHash(botToken, dataCheckString, receivedHash);
}

/** Параметры из query string (GET после редиректа с виджета). */
export function telegramWidgetParamsFromSearchParams(
  searchParams: URLSearchParams,
): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [key, value] of searchParams.entries()) {
    if (key === "id") {
      const n = Number(value);
      if (Number.isFinite(n)) o.id = n;
      continue;
    }
    if (key === "auth_date") {
      const n = Number(value);
      if (Number.isFinite(n)) o.auth_date = n;
      continue;
    }
    o[key] = value;
  }
  return o;
}

export function profileFromVerifiedWidgetData(
  data: Record<string, unknown>,
): TelegramVerifiedProfile | null {
  const id = data.id;
  if (typeof id !== "number" || !Number.isFinite(id) || id <= 0) {
    return null;
  }
  const firstName =
    typeof data.first_name === "string" && data.first_name.trim()
      ? data.first_name.trim()
      : "Пользователь";
  const lastName =
    typeof data.last_name === "string" && data.last_name.trim()
      ? data.last_name.trim()
      : null;
  const username =
    typeof data.username === "string" && data.username.trim()
      ? data.username.trim()
      : null;
  const photoUrl =
    typeof data.photo_url === "string" && data.photo_url.trim()
      ? data.photo_url.trim()
      : null;

  return {
    telegramId: id,
    firstName,
    lastName,
    username,
    photoUrl,
  };
}
