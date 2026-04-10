import type { CSSProperties } from "react";

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
 * Плитки категорий (квадрат): без обрезки — только `object-position` для сдвига
 * внутри вписанного кадра (см. разметку: flex + max-w/full h-full).
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
    objectFit: "contain",
    objectPosition: `${x}% ${y}%`,
  };
}
