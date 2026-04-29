/** sessionStorage: ждём выдачу кода в боте, затем редирект на /account */
export const TG_LOGIN_WAIT_STORAGE_KEY = "illucards_tg_login_wait_id";

export const TG_LOGIN_WAIT_ID_RE = /^[a-f0-9]{32}$/i;

export function isValidLoginWaitId(id: string): boolean {
  return TG_LOGIN_WAIT_ID_RE.test(id.trim());
}
