"use client";

import { useEffect } from "react";

/** Pause infinite CSS animations while the tab is in the background. */
export function PauseGpuWhenHidden() {
  useEffect(() => {
    const sync = () => {
      document.documentElement.classList.toggle("tab-hidden", document.hidden);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return null;
}
