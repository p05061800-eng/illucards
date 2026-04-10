import { parseImageFocus, type ImageFocus } from "@/app/lib/imageFocus";

export type CategoryTile = {
  name: string;
  /** Горизонтальный баннер раздела в коллекции. */
  image: string;
  imageFocus?: ImageFocus;
  /** Квадратная плашка в герое; если пусто — подставляется `image`. */
  plateImage?: string;
  plateImageFocus?: ImageFocus;
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
    return tile;
  });
}
