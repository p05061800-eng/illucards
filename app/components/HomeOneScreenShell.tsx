"use client";

import {
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";

/**
 * Главная в одном экране: высота под окно, без прокрутки документа.
 * Высота шапки пишется в `--home-header-h` (ResizeObserver).
 */
export function HomeOneScreenShell({ children }: { children: ReactNode }) {
  const mainRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const header = document.querySelector("header");
    const update = () => {
      const h = header?.getBoundingClientRect().height ?? 64;
      document.documentElement.style.setProperty(
        "--home-header-h",
        `${Math.ceil(h)}px`
      );
    };
    update();
    window.addEventListener("resize", update, { passive: true });
    const ro = header ? new ResizeObserver(update) : null;
    if (header && ro) ro.observe(header);
    document.documentElement.classList.add("home-one-screen");
    return () => {
      window.removeEventListener("resize", update);
      ro?.disconnect();
      document.documentElement.classList.remove("home-one-screen");
      document.documentElement.style.removeProperty("--home-header-h");
    };
  }, []);

  return (
    <main
      ref={mainRef}
      className="main home-one-screen-main relative flex min-h-0 w-full flex-col overflow-hidden text-white"
    >
      {children}
    </main>
  );
}
