"use client";

import { useLayoutEffect, useState } from "react";

/** Телефон / планшет / тач-экран без стабильного hover. */
export function readTouchFriendlyPointer(): boolean {
  if (typeof window === "undefined") return false;
  const coarseMq = window.matchMedia(
    "(hover: none), (pointer: coarse), (any-pointer: coarse)",
  );
  if (coarseMq.matches) return true;
  const touchCapable =
    "maxTouchPoints" in navigator && navigator.maxTouchPoints > 0;
  const fineHoverMq = window.matchMedia("(hover: hover) and (pointer: fine)");
  return touchCapable && !fineHoverMq.matches;
}

/**
 * Телефон / грубый указатель: нет стабильного hover — для hover-MP4 нужны
 * `autoPlay` и видимый слой, иначе «гифка» не видна.
 */
export function useCoarsePointerOrHoverNone(): boolean {
  const [value, setValue] = useState(false);

  useLayoutEffect(() => {
    const coarseMq = window.matchMedia(
      "(hover: none), (pointer: coarse), (any-pointer: coarse)",
    );
    const sync = () => setValue(readTouchFriendlyPointer());
    sync();
    coarseMq.addEventListener("change", sync);
    return () => coarseMq.removeEventListener("change", sync);
  }, []);

  return value;
}
