import type { CSSProperties, Ref } from "react";
import { isFrontHoverVideoUrl } from "@/app/lib/frontHoverMotionUrl";

type Props = {
  url: string;
  className: string;
  style?: CSSProperties;
  /** Каталог/товар: кадр на всю область лица (`h/w-full` + `object-contain` + `style`). */
  fillFaceFrame?: boolean;
  /** Для GIF в превью каталога/героя */
  decoding?: "async" | "auto" | "sync";
  loading?: "eager" | "lazy";
  /** Запуск/пауза снаружи (pointer enter/leave зоны карты). */
  videoRef?: Ref<HTMLVideoElement | null>;
};

const HOVER_MEDIA_CLASS =
  "pointer-events-none block max-h-full max-w-full object-contain rounded-2xl";

const HOVER_MEDIA_FILL_CLASS =
  "pointer-events-none block h-full w-full rounded-2xl object-contain";

/**
 * Слой «лицо при наведении»: legacy GIF или короткое видео (тот же кадр, что лицевая сторона).
 * `className` — обёртка (позиция, hover opacity); по умолчанию кадр целиком (`object-contain`),
 * при `fillFaceFrame` — те же размеры рамки лица, без обрезки (`object-contain` + `style`).
 */
export function FrontHoverMotionOverlay({
  url,
  className,
  style,
  fillFaceFrame = false,
  decoding = "async",
  loading = "lazy",
  videoRef,
}: Props) {
  const t = url.trim();
  if (!t) return null;

  const mediaClass = fillFaceFrame ? HOVER_MEDIA_FILL_CLASS : HOVER_MEDIA_CLASS;

  if (isFrontHoverVideoUrl(t)) {
    return (
      <div className={className} aria-hidden>
        <video
          ref={videoRef}
          src={t}
          className={mediaClass}
          style={style}
          muted
          playsInline
          loop
          preload="metadata"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div className={className} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- legacy GIF */}
      <img
        src={t}
        alt=""
        className={mediaClass}
        style={style}
        draggable={false}
        decoding={decoding}
        loading={loading}
      />
    </div>
  );
}
