"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  compensatePageScrollY,
  restorePageScrollY,
} from "@/app/lib/preservePageScroll";

/** Ниже этого порога пользователь ещё в герое — не трогаем scroll. */
const GUARD_MIN_SCROLL_Y = 96;
/** Любой нежелательный скачок вверх при прокрученном каталоге. */
const JUMP_UP_PX = 4;

function shouldCompensateHeroResize(scrollY: number, heroHeight: number): boolean {
  if (scrollY < GUARD_MIN_SCROLL_Y) return false;
  return scrollY > heroHeight - 48;
}

/**
 * На главной: смена новинок / акций не должна сдвигать каталог
 * (компенсация изменения высоты героя + мелких скачков scroll).
 */
export function HomeHeroScrollGuard() {
  const pathname = usePathname();
  const anchorYRef = useRef(0);
  const heroPastRef = useRef(false);

  useEffect(() => {
    if (pathname !== "/") return;
    if (typeof window === "undefined") return;

    const hero = document.querySelector(".hero");
    if (!hero) return;

    let prevHeroHeight = hero.getBoundingClientRect().height;

    const syncAnchor = () => {
      anchorYRef.current = window.scrollY;
      heroPastRef.current = hero.getBoundingClientRect().bottom < 8;
    };

    syncAnchor();

    const onScroll = () => {
      const prev = anchorYRef.current;
      const next = window.scrollY;
      const jumpedUp =
        prev >= GUARD_MIN_SCROLL_Y &&
        heroPastRef.current &&
        next < prev - JUMP_UP_PX;

      if (jumpedUp) {
        restorePageScrollY(prev);
        return;
      }

      anchorYRef.current = next;
      heroPastRef.current = hero.getBoundingClientRect().bottom < 8;
    };

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        const delta = h - prevHeroHeight;
        if (Math.abs(delta) < 0.5) continue;

        const scrollY = window.scrollY;
        if (shouldCompensateHeroResize(scrollY, prevHeroHeight)) {
          compensatePageScrollY(delta);
          anchorYRef.current = window.scrollY;
          heroPastRef.current = hero.getBoundingClientRect().bottom < 8;
        }

        prevHeroHeight = h;
      }
    });

    ro.observe(hero);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);

  return null;
}
