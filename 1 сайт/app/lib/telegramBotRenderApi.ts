/**
 * HTTP API бота на Render (polling). На Vercel нет TELEGRAM_BOT_TOKEN — только этот клиент.
 */

/** Активный сервис на Render (не старый illucards-telegram-bot). */
const DEFAULT_BOT_API = "https://illucards.onrender.com";

export function telegramBotApiUrl(): string {
  return (
    process.env.TELEGRAM_BOT_API_URL?.trim() ||
    process.env.TELEGRAM_BOT_SYNC_URL?.trim() ||
    process.env.TELEGRAM_SYNC_API_URL?.trim() ||
    DEFAULT_BOT_API
  ).replace(/\/+$/, "");
}

function syncSecret(): string {
  return (
    process.env.TELEGRAM_SYNC_API_SECRET?.trim() ||
    process.env.ILLUCARDS_ORDER_UPDATE_SECRET?.trim() ||
    ""
  );
}

export function telegramBotSyncHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  const secret = syncSecret();
  return {
    "Content-Type": "application/json",
    ...(secret
      ? { Authorization: `Bearer ${secret}`, "X-Sync-Secret": secret }
      : {}),
    ...extra,
  };
}

type JsonRecord = Record<string, unknown>;

async function readJson(res: Response): Promise<JsonRecord | null> {
  try {
    const j = (await res.json()) as unknown;
    if (j && typeof j === "object" && !Array.isArray(j)) return j as JsonRecord;
  } catch {
    /* ignore */
  }
  return null;
}

function errorFromBody(
  data: JsonRecord | null,
  fallback: string,
): string {
  const err = data?.error;
  if (typeof err === "string" && err.trim()) return err.trim();
  return fallback;
}

export type BotApiSimpleResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/** POST /api/send-code — код входа в Telegram. */
export async function botSendLoginCode(
  username: string,
): Promise<BotApiSimpleResult> {
  const url = `${telegramBotApiUrl()}/api/send-code`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
      cache: "no-store",
    });
    const data = await readJson(res);
    if (res.ok && data?.ok === true) {
      console.info("[telegram-bot] send-code ok", { username, status: res.status });
      return { ok: true };
    }
    const err = errorFromBody(data, `HTTP ${res.status}`);
    console.warn("[telegram-bot] send-code failed", {
      username,
      status: res.status,
      error: err,
    });
    return { ok: false, status: res.status, error: err };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Сеть недоступна";
    console.warn("[telegram-bot] send-code error", { username, error: msg });
    return { ok: false, status: 0, error: msg };
  }
}

export type BotVerifyCodeInput = {
  code: string;
  username?: string;
  cart?: unknown[];
  deliveryCountry?: string;
  grandTotal?: number;
};

export type BotVerifyCodeResult =
  | { ok: true; user_id: number; username?: string }
  | { ok: false; status: number; error: string };

/** POST /api/verify-code */
export async function botVerifyLoginCode(
  input: BotVerifyCodeInput,
): Promise<BotVerifyCodeResult> {
  const url = `${telegramBotApiUrl()}/api/verify-code`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    const data = await readJson(res);
    const uidRaw = data?.user_id;
    const uid =
      typeof uidRaw === "number"
        ? uidRaw
        : typeof uidRaw === "string"
          ? Number(uidRaw)
          : NaN;
    if (res.ok && Number.isFinite(uid) && uid > 0) {
      console.info("[telegram-bot] verify-code ok", {
        status: res.status,
        user_id: Math.floor(uid),
      });
      return {
        ok: true,
        user_id: Math.floor(uid),
        username:
          typeof data?.username === "string" ? data.username : undefined,
      };
    }
    const err = errorFromBody(data, `HTTP ${res.status}`);
    console.warn("[telegram-bot] verify-code failed", {
      status: res.status,
      error: err,
    });
    const friendly =
      res.status === 503 || res.status === 502 || res.status === 504
        ? "Сервис бота временно недоступен. Подождите минуту и запросите новый код."
        : res.status === 401
          ? "Неверный или просроченный код"
          : err;
    return { ok: false, status: res.status, error: friendly };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Сеть недоступна";
    console.warn("[telegram-bot] verify-code error", { error: msg });
    return {
      ok: false,
      status: 0,
      error: "Не удалось связаться с ботом. Попробуйте через минуту.",
    };
  }
}

/** POST /api/telegram-auth — проверка Telegram Login Widget. */
export type BotTelegramAuthResult =
  | {
      ok: true;
      profile: {
        telegramId: number;
        firstName: string;
        lastName: string | null;
        username: string | null;
        photoUrl: string | null;
      };
    }
  | { ok: false; status: number; error: string };

export async function botVerifyTelegramWidget(
  widgetData: JsonRecord,
): Promise<BotTelegramAuthResult> {
  const url = `${telegramBotApiUrl()}/api/telegram-auth`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(widgetData),
      cache: "no-store",
    });
    const data = await readJson(res);
    if (res.ok && data?.ok === true && data.profile && typeof data.profile === "object") {
      const p = data.profile as JsonRecord;
      const id = p.telegramId ?? p.id;
      const tid =
        typeof id === "number" ? id : typeof id === "string" ? Number(id) : NaN;
      if (Number.isFinite(tid) && tid > 0) {
        return {
          ok: true,
          profile: {
            telegramId: Math.floor(tid),
            firstName:
              typeof p.firstName === "string"
                ? p.firstName
                : typeof p.first_name === "string"
                  ? p.first_name
                  : "Пользователь",
            lastName:
              typeof p.lastName === "string"
                ? p.lastName
                : typeof p.last_name === "string"
                  ? p.last_name
                  : null,
            username:
              typeof p.username === "string" ? p.username : null,
            photoUrl:
              typeof p.photoUrl === "string"
                ? p.photoUrl
                : typeof p.photo_url === "string"
                  ? p.photo_url
                  : null,
          },
        };
      }
    }
    const err = errorFromBody(data, `HTTP ${res.status}`);
    return { ok: false, status: res.status, error: err };
  } catch (e: unknown) {
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : "Сеть недоступна",
    };
  }
}

export type BotNotifyInput =
  | {
      target: "customer";
      telegramUserId: number;
      text: string;
    }
  | {
      target: "customer";
      event: "order_status";
      telegramUserId: number;
      botOrderId?: number | string;
      status: string;
    }
  | {
      target: "admin";
      text: string;
    }
  | {
      target: "admin";
      action: "delete_message";
      messageId: number;
    };

/** POST /api/purge-orders — очистить журнал заказов в боте. */
export async function botPurgeOrders(): Promise<
  { ok: true; deleted: number } | { ok: false; error: string }
> {
  const url = `${telegramBotApiUrl()}/api/purge-orders`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: telegramBotSyncHeaders(),
      body: JSON.stringify({}),
      cache: "no-store",
    });
    const data = await readJson(res);
    if (res.ok && data?.ok === true) {
      const n =
        typeof data.deleted === "number" && Number.isFinite(data.deleted)
          ? Math.floor(data.deleted)
          : 0;
      return { ok: true, deleted: n };
    }
    return {
      ok: false,
      error: errorFromBody(data, `HTTP ${res.status}`),
    };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Сеть недоступна",
    };
  }
}

/** POST /api/notify */
export async function botNotify(
  input: BotNotifyInput,
): Promise<BotApiSimpleResult> {
  const url = `${telegramBotApiUrl()}/api/notify`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: telegramBotSyncHeaders(),
      body: JSON.stringify(input),
      cache: "no-store",
    });
    const data = await readJson(res);
    if (res.ok && (data?.ok === true || data?.ok === undefined)) {
      console.info("[telegram-bot] notify ok", {
        target: "target" in input ? input.target : "?",
        status: res.status,
      });
      return { ok: true };
    }
    const err = errorFromBody(data, `HTTP ${res.status}`);
    console.warn("[telegram-bot] notify failed", {
      status: res.status,
      body: data,
      error: err,
    });
    return { ok: false, status: res.status, error: err };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Сеть недоступна";
    console.warn("[telegram-bot] notify error", { error: msg });
    return { ok: false, status: 0, error: msg };
  }
}
