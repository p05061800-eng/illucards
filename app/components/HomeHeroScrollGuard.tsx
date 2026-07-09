"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { restorePageScrollY } from "@/app/lib/preservePageScroll";

/** Ниже этого порога пользователь ещё в герое — не фиксируем scroll. */
const GUARD_MIN_SCROLL_Y = 96;
/** Скачок вверх больше этого — восстанавливаем позицию. */
const JUMP_UP_PX = 48;

/**
 * На главной: смена новинок / акций не должна подтягивать страницу вверх
 * (layout shift героя + scroll anchoring на iOS).
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

    const maybeRestore = () => {
      const saved = anchorYRef.current;
      if (saved < GUARD_MIN_SCROLL_Y) return;
      if (window.scrollY >= saved - JUMP_UP_PX) return;
      restorePageScrollY(saved);
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

    const ro = new ResizeObserver(() => {
      const h = hero.getBoundingClientRect().height;
      if (Math.abs(h - prevHeroHeight) < 2) return;
      prevHeroHeight = h;
      if (anchorYRef.current < GUARD_MIN_SCROLL_Y) return;
      maybeRestore();
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
