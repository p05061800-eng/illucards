"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  parseCatalogCardIdFromHash,
  peekCatalogReturnCardId,
} from "@/app/lib/catalogScrollRestore";

const SCROLL_PREFIX = "illucards:scroll:";

function routeKey(pathname: string, search: string): string {
  return search ? `${pathname}?${search}` : pathname;
}

function readScroll(key: string): number | null {
  try {
    const raw = sessionStorage.getItem(SCROLL_PREFIX + key);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

function writeScroll(key: string, y: number): void {
  try {
    sessionStorage.setItem(SCROLL_PREFIX + key, String(Math.round(y)));
  } catch {
    /* storage disabled */
  }
}

function shouldDeferToCatalogAnchor(pathname: string): boolean {
  if (pathname !== "/") return false;
  if (peekCatalogReturnCardId()) return true;
  if (typeof window !== "undefined" && parseCatalogCardIdFromHash(window.location.hash)) {
    return true;
  }
  return false;
}

function restoreScrollY(y: number): void {
  const apply = () => window.scrollTo({ left: 0, top: y, behavior: "auto" });
  apply();
  requestAnimationFrame(apply);
  requestAnimationFrame(() => requestAnimationFrame(apply));
  window.setTimeout(apply, 0);
  window.setTimeout(apply, 50);
}

/** Восстанавливает scroll при «Назад» / «Вперёд» в браузере (не сбрасывает вверх). */
export function ScrollPositionRestore() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const key = routeKey(pathname, search ? `?${search}` : "");
  const navigatingHistoryRef = useRef(false);

  useEffect(() => {
    try {
      if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
      }
    } catch {
      /* noop */
    }
    const onPopState = () => {
      navigatingHistoryRef.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const onScroll = () => writeScroll(key, window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [key]);

  useLayoutEffect(() => {
    if (!navigatingHistoryRef.current) return;
    navigatingHistoryRef.current = false;

    if (shouldDeferToCatalogAnchor(pathname)) return;

    const y = readScroll(key);
    if (y == null || y <= 0) return;

    restoreScrollY(y);
  }, [key, pathname]);

  return null;
}
