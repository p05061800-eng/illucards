"use client";

export {
  CARD_ART_INTRINSIC_DEFAULT_HEIGHT as CARD_IMAGE_INTRINSIC_HEIGHT,
  CARD_ART_INTRINSIC_DEFAULT_WIDTH as CARD_IMAGE_INTRINSIC_WIDTH,
} from "@/app/lib/cardArtIntrinsicSize";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import {
  DEFAULT_CARD_ASPECT_RATIO_CSS,
  bucketCardArtFrameAspectCssFromDimensions,
} from "@/app/lib/cardAspectRatio";
import type { ImageFocus } from "@/app/lib/imageFocus";

type Props = {
  src: string;
  /** Сохраняется в данных; на превью не используется (показ только по центру). */
  value?: ImageFocus;
  onChange?: (v: ImageFocus) => void;
  /**
   * Фиксированная рамка (баннеры, меню, квадрат). Если не задано — превью
   * ровно под размер файла.
   */
  aspectClass?: string;
  /**
   * Надёжнее arbitrary Tailwind (дробь с `/` ломается): строка для CSS `aspect-ratio`.
   */
  aspectRatioCss?: string;
  /**
   * При заданной рамке: `cover` (меню, баннеры) или `contain` (превью лица карты как на витрине).
   */
  objectFit?: "cover" | "contain";
  /**
   * Рамка после загрузки: 16/6 при w>h, иначе 3/4. Не задавайте вместе с `aspectClass` / `aspectRatioCss`.
   */
  orientationFromImage?: boolean;
  /** Стили на `<img>` (например `object-position` / `contain` с админского фокуса). */
  imageStyle?: CSSProperties;
  className?: string;
  hint?: string;
};

/**
 * Превью в фиксированной рамке: по умолчанию `object-fit: cover`; при `objectFit="contain"`
 * кадр целиком внутри рамки (превью лица карты как на витрине).
 * Без `aspectClass` / `aspectRatioCss` — нативный `<img>`, высота от файла.
 */
export function DraggableImageFrame({
  src,
  className = "",
  aspectClass,
  aspectRatioCss,
  objectFit = "cover",
  orientationFromImage = false,
  imageStyle,
  hint = "",
}: Props) {
  const [orientedAspect, setOrientedAspect] = useState(
    DEFAULT_CARD_ASPECT_RATIO_CSS,
  );

  useEffect(() => {
    if (!orientationFromImage) return;
    setOrientedAspect(DEFAULT_CARD_ASPECT_RATIO_CSS);
  }, [orientationFromImage, src]);

  const fixedFrame =
    orientationFromImage ||
    Boolean(aspectClass) ||
    Boolean(aspectRatioCss);

  if (!fixedFrame) {
    return (
      <div className={`w-full ${className}`}>
        <div className="relative w-full overflow-visible rounded-2xl border border-white/15 bg-zinc-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            draggable={false}
            decoding="async"
            className="box-border block h-auto w-full max-w-full align-top"
          />
        </div>
        {hint ? (
          <p className="pointer-events-none pt-1.5 text-center text-[10px] leading-snug text-white/75">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }

  const frameAspectStyle =
    orientationFromImage && objectFit === "cover"
      ? { aspectRatio: orientedAspect }
      : aspectRatioCss
        ? { aspectRatio: aspectRatioCss }
        : {};

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`relative w-full overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 ${
          orientationFromImage ? "" : (aspectClass ?? "")
        }`}
        style={frameAspectStyle}
      >
        {objectFit === "contain" ? (
          <div className="absolute inset-0 flex min-h-0 min-w-0 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none max-h-full max-w-full"
              style={imageStyle}
            />
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
              style={imageStyle}
              onLoad={
                orientationFromImage
                  ? (e) =>
                      setOrientedAspect(
                        bucketCardArtFrameAspectCssFromDimensions(
                          e.currentTarget.naturalWidth,
                          e.currentTarget.naturalHeight,
                        ),
                      )
                  : undefined
              }
            />
          </>
        )}
      </div>
      {hint ? (
        <p className="pointer-events-none pt-1.5 text-center text-[10px] leading-snug text-white/75">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
