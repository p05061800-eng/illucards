/**
 * Стандартная коллекционная карта / постер Marvel-стиля (портрет w ≤ h) — фикс 2:3.
 */
export const CARD_ART_STANDARD_PORTRAIT_ASPECT_CSS = "2 / 3";

/** @deprecated Используйте `CARD_ART_STANDARD_PORTRAIT_ASPECT_CSS` (раньше было 3/4). */
export const CARD_ART_PORTRAIT_FRAME_ASPECT_CSS =
  CARD_ART_STANDARD_PORTRAIT_ASPECT_CSS;

/** Постер TMNT на витрине — как референс 761×1024 (вторая опорная картинка). */
export const CARD_ART_TMNT_POSTER_ASPECT_CSS = "761 / 1024";

/** Горизонтальный баннер на витрине (w > h). */
export const CARD_ART_LANDSCAPE_FRAME_ASPECT_CSS = "16 / 6";

/** Пока нет размеров файла — рамка 2:3. */
export const DEFAULT_CARD_ASPECT_RATIO_CSS = CARD_ART_STANDARD_PORTRAIT_ASPECT_CSS;

/** @deprecated Жёсткие пресеты витрины отключены — оставлено для типов в API/JSON. */
export const CARD_FRAME_LEGACY_ASPECT_CSS = "681 / 1024";

export type CardArtFramePreset =
  | "file"
  | "legacy681"
  | "upload600"
  | "upload800x800"
  | "upload800x950"
  | "upload900x1200"
  | "upload1000x1200"
  | "upload828x950";

/**
 * Жёсткая «эталонная» рамка витрины в UI больше не используется: карточка всегда
 * в пропорциях файла лица (метаданные или интринсик), без обрезки и без полей.
 */
export function isFixedCardArtFramePreset(
  _p: CardArtFramePreset | undefined,
): boolean {
  void _p;
  return false;
}

export function parseCardArtFramePreset(
  raw: unknown,
): CardArtFramePreset | undefined {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "file") return "file";
  /** Любые сохранённые пресеты читаем, но витрина их не применяет. */
  if (
    s === "legacy681" ||
    s === "upload600" ||
    s === "upload800x800" ||
    s === "upload800x950" ||
    s === "upload900x1200" ||
    s === "upload1000x1200" ||
    s === "upload828x950" ||
    s === "upload828x1102" ||
    s === "upload818x1100" ||
    s === "upload768x1024" ||
    s === "upload600x800" ||
    s === "upload600x600"
  ) {
    return "file";
  }
  return undefined;
}

function gcdPair(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/** Сокращённая дробь W:H для CSS `aspect-ratio`. */
export function aspectRatioCssFromDimensions(w: number, h: number): string {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return DEFAULT_CARD_ASPECT_RATIO_CSS;
  }
  const g = gcdPair(w, h);
  return `${Math.round(w / g)} / ${Math.round(h / g)}`;
}

/** Рамка витрины по ориентации лица: баннер 16/6, иначе постер 2:3. */
export function bucketCardArtFrameAspectCssFromDimensions(
  w: number,
  h: number,
): string {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return DEFAULT_CARD_ASPECT_RATIO_CSS;
  }
  return w > h
    ? CARD_ART_LANDSCAPE_FRAME_ASPECT_CSS
    : CARD_ART_STANDARD_PORTRAIT_ASPECT_CSS;
}

/**
 * Пиксели референсного постера TMNT (файл пользователя) — единая рамка витрины и поля
 * `frontImageWidth` / `frontImageHeight` при сохранении карточки в API.
 */
export const TMNT_REFERENCE_POSTER_DIMENSIONS = {
  width: 761,
  height: 1024,
} as const;

function isTmntCategory(card: { category?: string }): boolean {
  return (card.category ?? "").trim().toLowerCase() === "tmnt";
}

/**
 * Рамка витрины: TMNT — фикс 761/1024; иначе по API или хуку — баннер 16/6 или постер 2:3.
 */
export function resolveCardArtBoxAspectCss(
  card: {
    category?: string;
    frontImageWidth?: number;
    frontImageHeight?: number;
    cardArtFramePreset?: CardArtFramePreset;
  },
  aspectFromClientHook: string,
  _categoryFrameAspectCss?: string | null,
): string {
  void card.cardArtFramePreset;
  void _categoryFrameAspectCss;
  if (isTmntCategory(card)) {
    return CARD_ART_TMNT_POSTER_ASPECT_CSS;
  }
  if (
    typeof card.frontImageWidth === "number" &&
    typeof card.frontImageHeight === "number" &&
    card.frontImageWidth > 0 &&
    card.frontImageHeight > 0
  ) {
    return bucketCardArtFrameAspectCssFromDimensions(
      card.frontImageWidth,
      card.frontImageHeight,
    );
  }
  return aspectFromClientHook;
}
