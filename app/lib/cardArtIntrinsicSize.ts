/**
 * Размер лица карты после аплоада (`imageBufferTo34Webp` в `serverImage.ts`) — 600×900, 2:3.
 * Подсказки для `next/image` (корзина и т.д.), когда точные пиксели файла не известны.
 */
export const CARD_ART_UPLOAD_WIDTH = 600;
export const CARD_ART_UPLOAD_HEIGHT = 900;

/** Fallback width/height для `next/image`, если нет метаданных с клиента. */
export const CARD_ART_INTRINSIC_DEFAULT_WIDTH = CARD_ART_UPLOAD_WIDTH;
export const CARD_ART_INTRINSIC_DEFAULT_HEIGHT = CARD_ART_UPLOAD_HEIGHT;

/** @deprecated Использовать `CARD_ART_INTRINSIC_DEFAULT_*` — размеры совпадают. */
export const CARD_ART_INTRINSIC_MARVEL_ST_WIDTH = CARD_ART_UPLOAD_WIDTH;
/** @deprecated Использовать `CARD_ART_INTRINSIC_DEFAULT_*` — размеры совпадают. */
export const CARD_ART_INTRINSIC_MARVEL_ST_HEIGHT = CARD_ART_UPLOAD_HEIGHT;

/** Пара width/height для `next/image` (плейсхолдер / `sizes`). */
export function getCardArtIntrinsicSize(
  _category?: string | undefined,
  _tiles?: unknown,
): {
  width: number;
  height: number;
} {
  void _category;
  void _tiles;
  return {
    width: CARD_ART_INTRINSIC_DEFAULT_WIDTH,
    height: CARD_ART_INTRINSIC_DEFAULT_HEIGHT,
  };
}
