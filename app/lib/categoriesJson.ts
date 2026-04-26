import { parseImageFocus, type ImageFocus } from "@/app/lib/imageFocus";
import { bucketCardArtFrameAspectCssFromDimensions } from "@/app/lib/cardAspectRatio";

export type CategoryTile = {
  name: string;
  /** Горизонтальный баннер раздела в коллекции. */
  image: string;
  imageFocus?: ImageFocus;
  /** Квадратная плашка в герое; если пусто — подставляется `image`. */
  plateImage?: string;
  plateImageFocus?: ImageFocus;
  /**
   * Эталонные пиксели рамки карточек витрины для этой категории (соотношение сторон).
   * Если не задано — общий fallback (файл лица / пресет карточки).
   */
  cardFrameWidth?: number;
  cardFrameHeight?: number;
};

export function parseCategoriesJson(raw: unknown): CategoryTile[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const o = row as Record<string, unknown>;
    const tile: CategoryTile = {
      name: typeof o.name === "string" ? o.name : "",
      image: typeof o.image === "string" ? o.image : "",
    };
    const f = parseImageFocus(o.imageFocus);
    if (f) {
      tile.imageFocus = f;
    }
    if (typeof o.plateImage === "string" && o.plateImage.trim()) {
      tile.plateImage = o.plateImage.trim();
    }
    const pf = parseImageFocus(o.plateImageFocus);
    if (pf) {
      tile.plateImageFocus = pf;
    }
    const cw = Number(o.cardFrameWidth);
    const ch = Number(o.cardFrameHeight);
    if (Number.isFinite(cw) && Number.isFinite(ch) && cw > 0 && ch > 0 && cw <= 65535 && ch <= 65535) {
      tile.cardFrameWidth = Math.round(cw);
      tile.cardFrameHeight = Math.round(ch);
    }
    return tile;
  });
}

/**
 * Сопоставление строки `category` из карточки с плиткой категории
 * (учёт регистра, Marvel ↔ Spider-Man, Stranger Things).
 */
export function findCategoryTileForCardCategory(
  tiles: readonly CategoryTile[],
  cardCategory: string | undefined,
): CategoryTile | undefined {
  const c = cardCategory?.trim() ?? "";
  if (!c) return undefined;
  const byExact = tiles.find((t) => t.name === c);
  if (byExact) return byExact;
  const lower = c.toLowerCase();
  const byLower = tiles.find((t) => t.name.toLowerCase() === lower);
  if (byLower) return byLower;
  if (c === "Очень странные дела") {
    return tiles.find((t) => t.name === "Stranger Things");
  }
  const marvel = tiles.find((t) => t.name === "Marvel");
  if (
    marvel &&
    (lower === "marvel" || lower === "spider-man" || lower === "spider man")
  ) {
    return marvel;
  }
  return undefined;
}

export function categoryFrameAspectCssFromTile(
  tile: CategoryTile | undefined,
): string | undefined {
  const w = tile?.cardFrameWidth;
  const h = tile?.cardFrameHeight;
  if (
    typeof w !== "number" ||
    typeof h !== "number" ||
    w <= 0 ||
    h <= 0
  ) {
    return undefined;
  }
  return bucketCardArtFrameAspectCssFromDimensions(w, h);
}

export function categoryFrameAspectCssFromTiles(
  tiles: readonly CategoryTile[],
  cardCategory: string | undefined,
): string | undefined {
  return categoryFrameAspectCssFromTile(
    findCategoryTileForCardCategory(tiles, cardCategory),
  );
}
