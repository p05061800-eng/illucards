/** Секреты, которыми бот на Render авторизуется к API сайта. */
export function botSyncSecrets(): string[] {
  const out: string[] = [];
  const order = process.env.ILLUCARDS_ORDER_UPDATE_SECRET?.trim();
  const sync = process.env.TELEGRAM_SYNC_API_SECRET?.trim();
  const login = process.env.ILLUCARDS_LOGIN_CODE_SYNC_SECRET?.trim();
  if (order) out.push(order);
  if (sync && !out.includes(sync)) out.push(sync);
  if (login && !out.includes(login)) out.push(login);
  return out;
}

export function botApiAuthRequired(): boolean {
  return botSyncSecrets().length > 0;
}

export function botBearerAuthorized(request: Request): boolean {
  const secrets = botSyncSecrets();
  if (!secrets.length) return false;
  const auth = (request.headers.get("authorization") || "").trim();
  if (!auth.toLowerCase().startsWith("bearer ")) return false;
  const tok = auth.slice(7).trim();
  return secrets.some((s) => tok === s);
}
