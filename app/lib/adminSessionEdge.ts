/**
 * Проверка cookie админки без node:crypto — для proxy.ts (Edge).
 */
export const ADMIN_SESSION_COOKIE = "illucards_admin_session";

export function isAdminPagePath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isAdminLoginPath(pathname: string): boolean {
  return pathname === "/admin/login";
}

export function isAdminMutatingApi(pathname: string, method: string): boolean {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return false;
  return (
    pathname === "/api/cards" ||
    pathname === "/api/categories" ||
    pathname === "/api/menu" ||
    pathname === "/api/social-links" ||
    pathname === "/api/promo-slides"
  );
}

function signingSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.TELEGRAM_WIDGET_COOKIE_SECRET?.trim() ||
    process.env.ILLUCARDS_ORDER_UPDATE_SECRET?.trim() ||
    process.env.ADMIN_PASSWORD?.trim() ||
    ""
  );
}

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function utf8ToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

async function hmacSha256Base64Url(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8ToBytes(secret) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, utf8ToBytes(data) as BufferSource);
  return bytesToBase64Url(sig);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function unsealAdminSessionEdge(
  cookieValue: string | undefined,
): Promise<{ login: string; exp: number } | null> {
  if (!cookieValue) return null;
  const secret = signingSecret();
  if (!secret) return null;
  const dot = cookieValue.indexOf(".");
  if (dot < 1) return null;
  const body = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  if (!body || !sig) return null;
  const expected = await hmacSha256Base64Url(secret, body);
  if (!timingSafeEqualStr(sig, expected)) return null;
  try {
    const b64 = body.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Record<string, unknown>;
    const login = typeof p.login === "string" ? p.login.trim() : "";
    const exp = typeof p.exp === "number" ? p.exp : Number(p.exp);
    if (!login || !Number.isFinite(exp)) return null;
    if (exp < Math.floor(Date.now() / 1000)) return null;
    return { login, exp };
  } catch {
    return null;
  }
}
