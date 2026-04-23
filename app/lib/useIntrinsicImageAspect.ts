"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_CARD_ASPECT_RATIO_CSS,
  aspectRatioCssFromDimensions,
} from "@/app/lib/cardAspectRatio";

export { aspectRatioCssFromDimensions } from "@/app/lib/cardAspectRatio";

/**
 * Рамка под реальный файл: соотношение сторон = naturalWidth / naturalHeight лица карты.
 * Пока грузится — `DEFAULT_CARD_ASPECT_RATIO_CSS`.
 * Если `src` пустой — не грузим (используйте `resolveCardArtBoxAspectCss` с размерами из API).
 */
export function useIntrinsicImageAspect(src: string | null | undefined): {
  aspectRatioCss: string;
} {
  const [ar, setAr] = useState<string>(DEFAULT_CARD_ASPECT_RATIO_CSS);

  useEffect(() => {
    const s = src?.trim();
    if (!s) {
      setAr(DEFAULT_CARD_ASPECT_RATIO_CSS);
      return;
    }
    const img = new Image();
    let cancelled = false;
    img.onload = () => {
      if (cancelled) return;
      setAr(
        aspectRatioCssFromDimensions(img.naturalWidth, img.naturalHeight),
      );
    };
    img.onerror = () => {
      if (cancelled) return;
      setAr(DEFAULT_CARD_ASPECT_RATIO_CSS);
    };
    img.src = s;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return { aspectRatioCss: ar };
}
