"use client";

import Link from "next/link";
import { useCallback, useRef, useState, type MouseEvent } from "react";

/** Логотип витрины: крупный, объёмный 3D, наклон следует за курсором */
export function HeroIlluCardsLogo() {
  const ref = useRef<HTMLAnchorElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);

  const onMove = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    const max = 26;
    setTilt({ x: py * -max, y: px * max });
  }, []);

  const onEnter = useCallback(() => setHovering(true), []);
  const onLeave = useCallback(() => {
    setHovering(false);
    setTilt({ x: 0, y: 0 });
  }, []);

  const baseX = 6;
  const baseY = -8;
  const rx = baseX + tilt.x;
  const ry = baseY + tilt.y;
  const tz = hovering ? 28 : 16;

  return (
    <Link
      ref={ref}
      href="/"
      onMouseMove={onMove}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="group relative block max-w-full shrink-0 select-none rounded-md outline-none [perspective:1200px] focus-visible:ring-2 focus-visible:ring-violet-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070510]"
      aria-label="IlluCards — на главную"
    >
      <span
        className="relative inline-block origin-center will-change-transform [transform-style:preserve-3d] transition-[transform] duration-500 ease-out"
        style={{
          transform: `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(${tz}px) scale(${hovering ? 1.02 : 1})`,
          transitionDuration: hovering ? "45ms" : "500ms",
        }}
      >
        <span
          className="site-hero-wordmark relative block text-4xl font-bold tracking-tight drop-shadow-[0_2px_0_rgba(0,0,0,0.5),0_8px_28px_rgba(91,33,182,0.35),0_20px_44px_rgba(0,0,0,0.5)] sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl xl:leading-[0.95]"
          style={{
            fontFeatureSettings: '"ss01" 1',
            transform: "translateZ(20px)",
          }}
        >
          IlluCards
        </span>
        <span
          className="site-text-muted mt-2 block text-xs font-medium uppercase tracking-[0.28em] transition group-hover:opacity-100 sm:mt-3 sm:text-sm"
          style={{ transform: "translateZ(8px)" }}
        >
          коллекционные карточки
        </span>
      </span>
    </Link>
  );
}
