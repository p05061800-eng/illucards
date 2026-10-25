import {
  BERSERK_REFERENCE_POSTER_DIMENSIONS,
  TMNT_REFERENCE_POSTER_DIMENSIONS,
  TRANSFORMERS_PRIME_REFERENCE_POSTER_DIMENSIONS,
  isBerserkCategory,
  isTransformersPrimeCategory,
} from "./cardAspectRatio";

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
  category?: string | undefined,
  _tiles?: unknown,
): {
  width: number;
  height: number;
} {
  void _tiles;
  const n = (category ?? "").trim().toLowerCase();
  if (n === "tmnt") {
    return TMNT_REFERENCE_POSTER_DIMENSIONS;
  }
  if (isBerserkCategory(category)) {
    return BERSERK_REFERENCE_POSTER_DIMENSIONS;
  }
  if (isTransformersPrimeCategory(category)) {
    return TRANSFORMERS_PRIME_REFERENCE_POSTER_DIMENSIONS;
  }
  return {
    width: CARD_ART_INTRINSIC_DEFAULT_WIDTH,
    height: CARD_ART_INTRINSIC_DEFAULT_HEIGHT,
  };
}
