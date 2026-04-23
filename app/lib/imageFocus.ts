import type { CSSProperties } from "react";
import {
  isFixedCardArtFramePreset,
  type CardArtFramePreset,
} from "@/app/lib/cardAspectRatio";

/** Кадрирование cover: смещение якоря в процентах (0–100), как в `object-position`. */
export type ImageFocus = { x: number; y: number };

export const DEFAULT_IMAGE_FOCUS: ImageFocus = { x: 50, y: 50 };

/**
 * Лёгкий zoom поверх `object-fit: cover`, чтобы `object-position` давал
 * заметный сдвиг и по X, и по Y (при одинаковом аспекте рамки и файла без zoom сдвиг по одной из осей почти нулевой).
 */
export const FOCUS_COVER_ZOOM = 1.11;

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
}

export function parseImageFocus(raw: unknown): ImageFocus | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const x = Number(o.x);
  const y = Number(o.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return { x: clampPct(x), y: clampPct(y) };
}

export function parseImageFocusJson(s: string): ImageFocus | undefined {
  const t = s.trim();
  if (!t) return undefined;
  try {
    return parseImageFocus(JSON.parse(t) as unknown);
  } catch {
    return undefined;
  }
}

export function focusToStyle(focus?: ImageFocus | null): CSSProperties {
  const x =
    typeof focus?.x === "number" && Number.isFinite(focus.x)
      ? clampPct(focus.x)
      : 50;
  const y =
    typeof focus?.y === "number" && Number.isFinite(focus.y)
      ? clampPct(focus.y)
      : 50;
  return {
    objectPosition: `${x}% ${y}%`,
    transform: `scale(${FOCUS_COVER_ZOOM})`,
    transformOrigin: "50% 50%",
  };
}

/** Горизонтальный баннер категории: `object-fit: cover` + только сдвиг кадра (без zoom). */
export function focusObjectPositionOnly(focus?: ImageFocus | null): CSSProperties {
  const x =
    typeof focus?.x === "number" && Number.isFinite(focus.x)
      ? clampPct(focus.x)
      : 50;
  const y =
    typeof focus?.y === "number" && Number.isFinite(focus.y)
      ? clampPct(focus.y)
      : 50;
  return { objectPosition: `${x}% ${y}%` };
}

/**
 * Витрина / арт карты: вся картинка внутри рамки без обрезки (`contain`) + якорь из админки.
 * Если пропорции файла и рамки разные, по краям возможны поля; чтобы их не было — грузите арт
 * в том же соотношении сторон, что и рамка (она по `naturalWidth`/`naturalHeight` лица).
 * См. также `categoryFocusCoverStyle` (без полей, но с обрезкой).
 */
export function categoryFocusContainStyle(focus?: ImageFocus | null): CSSProperties {
  const x =
    typeof focus?.x === "number" && Number.isFinite(focus.x)
      ? clampPct(focus.x)
      : 50;
  const y =
    typeof focus?.y === "number" && Number.isFinite(focus.y)
      ? clampPct(focus.y)
      : 50;
  return {
    objectFit: "contain",
    objectPosition: `${x}% ${y}%`,
  };
}

/**
 * Заполнение рамки без полос — `cover` + якорь (часть кадра обрезается).
 */
export function categoryFocusCoverStyle(focus?: ImageFocus | null): CSSProperties {
  const x =
    typeof focus?.x === "number" && Number.isFinite(focus.x)
      ? clampPct(focus.x)
      : 50;
  const y =
    typeof focus?.y === "number" && Number.isFinite(focus.y)
      ? clampPct(focus.y)
      : 50;
  return {
    objectFit: "cover",
    objectPosition: `${x}% ${y}%`,
  };
}

/**
 * Лицо карточки: при жёсткой рамке витрины — `object-fit: contain`, чтобы кадр был
 * целиком виден (возможны поля по краям). Иначе — естественные пропорции файла.
 */
export function cardArtFaceFitStyle(
  preset: CardArtFramePreset | undefined,
  focus?: ImageFocus | null,
): CSSProperties {
  if (!isFixedCardArtFramePreset(preset)) {
    return {};
  }
  const x =
    typeof focus?.x === "number" && Number.isFinite(focus.x)
      ? clampPct(focus.x)
      : 50;
  const y =
    typeof focus?.y === "number" && Number.isFinite(focus.y)
      ? clampPct(focus.y)
      : 50;
  return {
    objectFit: "contain",
    objectPosition: `${x}% ${y}%`,
    maxWidth: "100%",
    maxHeight: "100%",
  };
}

export function cardArtFaceObjectFitClass(
  _preset: CardArtFramePreset | undefined,
): string {
  return "";
}

/** Обёртка лица в стопке/3D: под `cardArtFaceFitStyle` с жёсткой рамкой. */
export function cardArtFixedFrameShellClass(fixed: boolean): string {
  return fixed
    ? "flex h-full w-full min-h-0 min-w-0 items-center justify-center"
    : "flex min-h-0 min-w-0 items-start justify-center";
}

export function cardArtFixedFrameImgClass(fixed: boolean): string {
  return fixed
    ? "block h-auto w-auto max-h-full max-w-full"
    : "block h-auto w-full max-w-full";
}

/**
 * Плитки категорий (квадрат): без обрезки — только `object-position` для сдвига
 * внутри вписанного кадра (см. разметку: flex + max-w/full h-full).
 *
 * Для лица/оборота на витрине без обрезки см. `categoryFocusContainStyle`.
 */
export function categoryFocusToStyle(focus?: ImageFocus | null): CSSProperties {
  const x =
    typeof focus?.x === "number" && Number.isFinite(focus.x)
      ? clampPct(focus.x)
      : 50;
  const y =
    typeof focus?.y === "number" && Number.isFinite(focus.y)
      ? clampPct(focus.y)
      : 50;
  return {
    objectPosition: `${x}% ${y}%`,
  };
}

/**
 * Атрибут `sizes` для `next/image` на артах карты: запрашивать достаточное
 * разрешение при крупном показе (товар, стопки, герой, витрина).
 */
export const NEXT_IMAGE_CARD_ART_SIZES =
  "(max-width: 640px) 100vw, (max-width: 1024px) 92vw, (max-width: 1536px) 85vw, 1600px";
