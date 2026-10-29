/** Плашки категорий в шапке — одно место на витрине. */
export function isCatalogCategoryPlatesPath(pathname: string): boolean {
  const p = (pathname.split("?")[0] ?? "").trim();
  if (p === "/" || p === "/collection") return true;
  if (p.startsWith("/collection/")) return true;
  if (p.startsWith("/card/")) return true;
  return false;
}

export function collectionSlugFromPath(pathname: string): string {
  const p = (pathname.split("?")[0] ?? "").trim();
  if (!p.startsWith("/collection/")) return "";
  const slug = p.slice("/collection/".length).split("/")[0] ?? "";
  return slug.trim();
}
