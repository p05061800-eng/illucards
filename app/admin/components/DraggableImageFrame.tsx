"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import {
  categoryFocusToStyle,
  focusToStyle,
  type ImageFocus,
} from "@/app/lib/imageFocus";

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
}

type Props = {
  src: string;
  value: ImageFocus;
  onChange: (v: ImageFocus) => void;
  aspectClass?: string;
  className?: string;
  hint?: string;
  /** `contain` — как плитки категорий на сайте (картинка целиком). */
  objectFit?: "cover" | "contain";
};

/**
 * Панорамирование кадра при `object-fit: cover` — меняет `object-position`.
 * Жест обрабатывается на `window`, чтобы сдвиг работал во все стороны (включая диагональ)
 * и на тач-скролле страница не перехватывала вертикаль.
 */
export function DraggableImageFrame({
  src,
  value,
  onChange,
  aspectClass = "aspect-[3/4]",
  className = "",
  hint = "Тяните в любом направлении, чтобы сдвинуть кадр",
  objectFit = "cover",
}: Props) {
  const containHint =
    "Тяните, чтобы сдвинуть изображение (оно целиком в рамке, без обрезки)";
  const valueRef = useRef(value);
  useLayoutEffect(() => {
    valueRef.current = value;
  }, [value]);
  const lastRef = useRef({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);
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

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (activePointerId.current != null) return;

      e.preventDefault();
      activePointerId.current = e.pointerId;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* Safari / старые движки */
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
      className={`relative overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 touch-none select-none ${aspectClass} ${className} ${objectFit === "contain" ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
    >
      {objectFit === "contain" ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt=""
          draggable={false}
          className="category-tile-img pointer-events-none absolute inset-0 block"
          style={{
            ...categoryFocusToStyle(value),
            objectFit: "contain",
            width: "100%",
            height: "100%",
          }}
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-none h-full w-full cursor-grab object-cover active:cursor-grabbing"
          style={focusToStyle(value)}
        />
      )}
      <p className="pointer-events-none absolute bottom-1 left-0 right-0 text-center text-[10px] text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
        {objectFit === "contain" ? containHint : hint}
      </p>
    </div>
  );
}
