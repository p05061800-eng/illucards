/**
 * API path для fetch() в браузере.
 * На apex illucards.by запросы идут сразу на www — без 307 и рассинхрона cookie.
 */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host === "illucards.by") {
      return `https://www.illucards.by${p}`;
    }
  }
  return p;
}
