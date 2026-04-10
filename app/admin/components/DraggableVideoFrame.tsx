"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { focusToStyle, type ImageFocus } from "@/app/lib/imageFocus";

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
}

type Props = {
  src: string;
  value: ImageFocus;
  onChange: (v: ImageFocus) => void;
  /** Рамка превью (по умолчанию 16:9 — удобно для любого исходного видео). */
  aspectClass?: string;
  className?: string;
  hint?: string;
};

/**
 * Превью видео в фиксированной рамке: `object-fit: cover` + сдвиг кадра,
 * как у фото. Подходит для любого разрешения и соотношения сторон файла.
 */
export function DraggableVideoFrame({
  src,
  value,
  onChange,
  aspectClass = "aspect-video",
  className = "",
  hint = "Тяните, чтобы выбрать видимую область кадра",
}: Props) {
  const valueRef = useRef(value);
  useLayoutEffect(() => {
    valueRef.current = value;
  }, [value]);
  const lastRef = useRef({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const cleanupRef = useRef<(() => void) | null>(null);

  const endDrag = useCallback(() => {
    const id = activePointerId.current;
    const el = rootRef.current;
    if (id != null && el) {
      try {
        if (el.hasPointerCapture?.(id)) el.releasePointerCapture(id);
      } catch {
        /* ignore */
      }
    }
    cleanupRef.current?.();
    cleanupRef.current = null;
    activePointerId.current = null;
  }, []);

  useEffect(() => {
    const onBlur = () => endDrag();
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("blur", onBlur);
      endDrag();
    };
  }, [endDrag]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.load();
    const p = el.play();
    if (p !== undefined) {
      void p.catch(() => {
        /* автозапуск может быть заблокирован до взаимодействия */
      });
    }
  }, [src]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (activePointerId.current != null) return;

      e.preventDefault();
      activePointerId.current = e.pointerId;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      lastRef.current = { x: e.clientX, y: e.clientY };

      const k = 0.18;

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== activePointerId.current) return;
        ev.preventDefault();
        const dx = ev.clientX - lastRef.current.x;
        const dy = ev.clientY - lastRef.current.y;
        lastRef.current = { x: ev.clientX, y: ev.clientY };
        const v = valueRef.current;
        onChange({
          x: clampPct(v.x - dx * k),
          y: clampPct(v.y - dy * k),
        });
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== activePointerId.current) return;
        endDrag();
      };

      window.addEventListener("pointermove", onMove, { passive: false, capture: true });
      window.addEventListener("pointerup", onUp, { capture: true });
      window.addEventListener("pointercancel", onUp, { capture: true });

      cleanupRef.current = () => {
        window.removeEventListener("pointermove", onMove, { capture: true });
        window.removeEventListener("pointerup", onUp, { capture: true });
        window.removeEventListener("pointercancel", onUp, { capture: true });
      };
    },
    [endDrag, onChange]
  );

  return (
    <div
      ref={rootRef}
      className={`relative overflow-hidden rounded-2xl border border-white/15 bg-black touch-none select-none ${aspectClass} ${className}`}
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
    >
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        autoPlay
        className="pointer-events-none h-full w-full cursor-grab object-cover active:cursor-grabbing"
        style={focusToStyle(value)}
        preload="metadata"
      />
      <p className="pointer-events-none absolute bottom-1 left-0 right-0 text-center text-[10px] text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
        {hint}
      </p>
    </div>
  );
}
