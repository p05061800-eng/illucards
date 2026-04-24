/** Плитка каталога с увеличенной рамкой TMNT: категория или маркер в названии. */
export function isTmntCatalogCard(card: {
  category?: string | null;
  title?: string | null;
}): boolean {
  const c = (card.category ?? "").trim();
  if (c === "TMNT" || c.toLowerCase() === "tmnt") return true;
  const t = (card.title ?? "").toLowerCase();
  return t.includes("tmnt") || t.includes("teenage mutant ninja turtles");
}
