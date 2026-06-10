/** sessionStorage: ждём подтверждения в боте после «Войти через Telegram» */
export const TG_LOGIN_WAIT_STORAGE_KEY = "illucards_tg_login_wait_id";

/** Query-параметр в ссылке из бота: /account?tg_wait=… */
export const TG_LOGIN_WAIT_QUERY_PARAM = "tg_wait";

export const TG_LOGIN_WAIT_ID_RE = /^[a-f0-9]{32}$/i;

export function isValidLoginWaitId(id: string): boolean {
  return TG_LOGIN_WAIT_ID_RE.test(id.trim());
}

export function accountUrlWithLoginWait(waitId: string, origin?: string): string {
  const base = (origin || "https://www.illucards.by").replace(/\/+$/, "");
  return `${base}/account?${TG_LOGIN_WAIT_QUERY_PARAM}=${encodeURIComponent(
    waitId.trim().toLowerCase(),
  )}`;
}
