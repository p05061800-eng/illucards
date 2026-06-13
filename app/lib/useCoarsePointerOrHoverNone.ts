"use client";

import { useEffect, useState } from "react";

/**
 * Телефон / грубый указатель: нет стабильного hover — для hover-MP4 нужны
 * `autoPlay` и видимый слой, иначе «гифка» не видна.
 */
export function useCoarsePointerOrHoverNone(): boolean {
  const [value, setValue] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const sync = () => setValue(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return value;
}
