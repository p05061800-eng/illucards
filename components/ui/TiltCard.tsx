"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Нормализованные координаты курсора (−1…1) для эффектов (например Vario). */
  onTilt?: (nx: number, ny: number) => void;
};

export default function TiltCard({
  children,
  className = "",
  onTilt,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const pendingRef = useRef<{ cx: number; cy: number } | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(
    () => () => {
      if (rafRef.current !== 0) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const flushMove = useCallback(() => {
    rafRef.current = 0;
    const el = ref.current;
    const p = pendingRef.current;
    if (!el || !p || reduceMotion) return;

    const rect = el.getBoundingClientRect();
    const x = p.cx - rect.left;
    const y = p.cy - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;

    const nx = (x / rect.width) * 2 - 1;
    const ny = (y / rect.height) * 2 - 1;
    onTilt?.(nx, ny);

    el.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  }, [reduceMotion, onTilt]);

  const handleMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el || reduceMotion) return;

      pendingRef.current = { cx: e.clientX, cy: e.clientY };
      if (rafRef.current !== 0) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(flushMove);
    },
    [reduceMotion, flushMove]
  );

  const handleLeave = useCallback(() => {
    pendingRef.current = null;
    if (rafRef.current !== 0) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const el = ref.current;
    if (!el || reduceMotion) return;
    onTilt?.(0, 0);
    el.style.transform = "rotateX(0deg) rotateY(0deg)";
  }, [reduceMotion, onTilt]);

  return (
    <div className={`[perspective:1100px] ${className}`.trim()}>
      <div
        ref={ref}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        className="transition-transform duration-200 will-change-transform"
        style={{
          transformStyle: "preserve-3d",
        }}
      >
        {children}
      </div>
    </div>
  );
}
