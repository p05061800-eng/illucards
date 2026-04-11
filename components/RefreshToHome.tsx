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

/**
 * Полное обновление страницы (F5):
 * — не главная → переход на `/`;
 * — главная с якорем (`/#collection`, `#collection-…`) → убираем хэш и скролл к герою,
 *   иначе после reload браузер открывает блок «Коллекции».
 */
export function RefreshToHome() {
  useLayoutEffect(() => {
    if (!isPageReload()) return;

    const path = window.location.pathname;
    const hash = window.location.hash;

    if (path !== "/") {
      window.location.replace("/");
      return;
    }

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

    /* Без этого после reload часто восстанавливается скролл к «Коллекциям», даже без # в URL */
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
    setTimeout(() => window.scrollTo(0, 0), 0);
  }, []);

  return null;
}
