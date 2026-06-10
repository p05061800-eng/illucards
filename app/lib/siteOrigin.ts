const PROD_CANONICAL_ORIGIN = "https://www.illucards.by";

export function isIllucardsProductionHost(host: string): boolean {
  const h = host.split(":")[0]?.trim().toLowerCase() ?? "";
  return h === "illucards.by" || h === "www.illucards.by";
}

/** Канонический origin для редиректов после входа (www). */
export function clientCanonicalSiteOrigin(): string {
  if (typeof window === "undefined") return PROD_CANONICAL_ORIGIN;
  const host = window.location.hostname.toLowerCase();
  if (isIllucardsProductionHost(host)) return PROD_CANONICAL_ORIGIN;
  return window.location.origin;
}
