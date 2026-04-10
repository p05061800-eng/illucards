"use client";

import { ChevronUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const SHOW_AFTER_PX = 380;

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={goTop}
      aria-label="Наверх страницы"
      className="fixed bottom-6 right-6 z-[190] flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/50 bg-zinc-900/95 text-white shadow-[0_4px_0_rgba(0,0,0,0.35),0_12px_40px_rgba(0,0,0,0.55),0_0_0_1px_rgba(168,85,247,0.35),0_0_28px_rgba(168,85,247,0.45)] backdrop-blur-md transition hover:border-fuchsia-300/80 hover:bg-purple-950/95 hover:shadow-[0_4px_0_rgba(0,0,0,0.25),0_14px_44px_rgba(0,0,0,0.5),0_0_0_1px_rgba(217,70,239,0.55),0_0_36px_rgba(192,132,252,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 sm:bottom-8 sm:right-8 sm:h-16 sm:w-16"
    >
      <ChevronUp
        className="h-8 w-8 stroke-[2.75] sm:h-9 sm:w-9"
        aria-hidden
      />
    </button>
  );
}
