export type PromoSlide = {
  id: string;
  imageUrl: string;
  /** Ссылка при клике: `/card/…`, `#collection`, `https://…` */
  href: string;
};

export type PromoSlidesFile = {
  items: PromoSlide[];
};

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

export function parsePromoSlides(data: unknown): PromoSlide[] {
  const rawItems =
    data &&
    typeof data === "object" &&
    "items" in data &&
    Array.isArray((data as PromoSlidesFile).items)
      ? (data as PromoSlidesFile).items
      : Array.isArray(data)
        ? data
        : [];

  const out: PromoSlide[] = [];
  for (const row of rawItems) {
    if (!row || typeof row !== "object") continue;
    const id = isNonEmptyString((row as { id?: unknown }).id)
      ? (row as { id: string }).id.trim()
      : "";
    const imageUrl = isNonEmptyString((row as { imageUrl?: unknown }).imageUrl)
      ? (row as { imageUrl: string }).imageUrl.trim()
      : "";
    const href = isNonEmptyString((row as { href?: unknown }).href)
      ? (row as { href: string }).href.trim()
      : "";
    if (!id || !imageUrl) continue;
    out.push({ id, imageUrl, href });
  }
  return out;
}

export function normalizePromoSlides(items: PromoSlide[]): PromoSlidesFile {
  const seen = new Set<string>();
  const cleaned: PromoSlide[] = [];
  for (const it of items) {
    const imageUrl = it.imageUrl?.trim() ?? "";
    if (!imageUrl) continue;
    let id = it.id?.trim() ?? "";
    if (!id) id = `promo-${cleaned.length}`;
    while (seen.has(id)) id = `${id}-x`;
    seen.add(id);
    cleaned.push({
      id,
      imageUrl,
      href: it.href?.trim() ?? "",
    });
  }
  return { items: cleaned };
}
