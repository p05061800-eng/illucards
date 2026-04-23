"use client";

import { useLayoutEffect } from "react";

function isPageReload(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const entries = performance.getEntriesByType(
      "navigation"
    ) as PerformanceNavigationTiming[];
    const nav = entries[0];
    if (nav?.type === "reload") return true;
  } catch {
    /* ignore */
  }
  const legacy = performance as Performance & {
    navigation?: { type?: number };
  };
  return legacy.navigation?.type === 1;
}

const isDev = process.env.NODE_ENV === "development";

/**
 * После полного обновления (F5), только в production:
 * — не главная → переход на `/` (как просили ранее).
 * — главная с якорем → убрать # и скролл к герою.
 *
 * В development не трогаем путь: иначе любая перезагрузка/HMR считается «reload»
 * и сбрасывает `/admin`, `/card/…` на главную — кажется, что «на сайт не зайти».
 */
export function RefreshToHome() {
  useLayoutEffect(() => {
    if (!isPageReload()) return;

    const path = window.location.pathname;
    const hash = window.location.hash;

    if (!isDev && path !== "/") {
      window.location.replace("/");
      return;
    }

    if (path !== "/") return;

    try {
      if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
      }
    } catch {
      /* ignore */
    }

    if (hash) {
      window.history.replaceState(null, "", "/");
    }

    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
    setTimeout(() => window.scrollTo(0, 0), 0);
  }, []);

  return null;
}
