/**
 * Единый идентификатор пользователя из Telegram (как на сайте, так и у бота).
 * `user_id` в объекте = числовой `id` пользователя в Telegram API.
 */

export const LS_TELEGRAM_USER_ID = "telegram_user_id";
/** JSON: { user_id: number, username: string } */
export const LS_TELEGRAM_USER = "illucards_telegram_user";

export const COOKIE_TELEGRAM_USER_ID = "telegram_user_id";
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

function canUseDom(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function setCookie(value: string, maxAgeSec: number): void {
  if (typeof document === "undefined") return;
  const secure = window.location?.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_TELEGRAM_USER_ID}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
}

function clearCookie(): void {
  if (typeof document === "undefined") return;
  const secure = window.location?.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_TELEGRAM_USER_ID}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

/** Сохранить после входа через Telegram (localStorage + cookie). */
export function persistTelegramUserIdentity(
  telegramId: number,
  username: string | null | undefined,
): void {
  if (!canUseDom()) return;
  if (!Number.isFinite(telegramId) || telegramId <= 0) return;
  const uname = typeof username === "string" ? username.replace(/^@/, "").trim() : "";
  try {
    localStorage.setItem(LS_TELEGRAM_USER_ID, String(telegramId));
    localStorage.setItem(
      LS_TELEGRAM_USER,
      JSON.stringify({
        user_id: telegramId,
        username: uname,
      }),
    );
    setCookie(String(telegramId), COOKIE_MAX_AGE_SEC);
  } catch {
    /* quota / private mode */
  }
}

export function clearTelegramUserIdentity(): void {
  if (!canUseDom()) return;
  try {
    localStorage.removeItem(LS_TELEGRAM_USER_ID);
    localStorage.removeItem(LS_TELEGRAM_USER);
  } catch {
    /* ignore */
  }
  clearCookie();
}

/** Основной идентификатор (Telegram user id), если сохранён. */
export function readTelegramPrimaryUserId(): number | null {
  if (!canUseDom()) return null;
  try {
    const raw = localStorage.getItem(LS_TELEGRAM_USER_ID);
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n);
  } catch {
    return null;
  }
}

export function readTelegramUserLink():
  | { user_id: number; username: string }
  | null {
  if (!canUseDom()) return null;
  try {
    const raw = localStorage.getItem(LS_TELEGRAM_USER);
    if (!raw) return null;
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const rec = o as Record<string, unknown>;
    const uid = rec.user_id;
    const n = typeof uid === "number" ? uid : Number(uid);
    if (!Number.isFinite(n) || n <= 0) return null;
    const username =
      typeof rec.username === "string" ? rec.username.replace(/^@/, "").trim() : "";
    return { user_id: Math.floor(n), username };
  } catch {
    return null;
  }
}

/** Применить данные из сессии к `telegram_user_id` / cookie (источник правды — сессия). */
export function syncTelegramIdentityFromSession(
  telegramId: number | undefined,
  username: string | null | undefined,
): void {
  if (telegramId == null || !Number.isFinite(telegramId) || telegramId <= 0) return;
  persistTelegramUserIdentity(telegramId, username ?? null);
}
