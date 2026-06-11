import type { CSSProperties, Ref } from "react";
import { isFrontHoverVideoUrl } from "@/app/lib/frontHoverMotionUrl";

type Props = {
  url: string;
  className: string;
  style?: CSSProperties;
  /** Каталог/товар: кадр на всю область лица (`h/w-full` + `object-cover` + `style`). */
  fillFaceFrame?: boolean;
  /** Запуск/пауза снаружи (pointer enter/leave зоны карты). */
  videoRef?: Ref<HTMLVideoElement | null>;
  /** Тач-устройства: без hover — включаем нативный autoplay (muted + playsInline). */
  autoPlay?: boolean;
};

const HOVER_MEDIA_CLASS =
  "pointer-events-none block max-h-full max-w-full object-contain rounded-2xl";

const HOVER_MEDIA_FILL_CLASS =
  "pointer-events-none block h-full w-full rounded-2xl object-cover";

/**
 * Слой «лицо при наведении»: короткое видео (тот же кадр, что лицевая сторона).
 * GIF не поддерживаются.
 */
export function FrontHoverMotionOverlay({
  url,
  className,
  style,
  fillFaceFrame = false,
  videoRef,
  autoPlay = false,
}: Props) {
  const t = url.trim();
  if (!t || !isFrontHoverVideoUrl(t)) return null;

  const mediaClass = fillFaceFrame ? HOVER_MEDIA_FILL_CLASS : HOVER_MEDIA_CLASS;

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
        preload={autoPlay ? "auto" : "metadata"}
        autoPlay={autoPlay}
        draggable={false}
      />
    </div>
  );
}
