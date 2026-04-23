"use client";

import { Move3d } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "illucards_card_tilt_hint_v1";

/**
 * Однократная подсказка на главной (герой): наклон/vario карточки.
 * Состояние «уже видели» — в localStorage.
 */
export function useFirstVisitCardTiltHint(enabled: boolean) {
  const dismissedRef = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    setVisible(true);
  }, [enabled]);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(dismiss, 14000);
    return () => window.clearTimeout(t);
  }, [visible, dismiss]);

  return { visible, dismiss };
}

export function FirstVisitCardTiltHint({
  visible,
  hasVario,
}: {
  visible: boolean;
  hasVario: boolean;
}) {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const sync = () => setCoarse(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (!visible) return null;

  const line = coarse
    ? hasVario
      ? "Ведите палец влево и вправо — смотрите обе стороны карточки"
      : "На большом экране наведите курсор — карточка наклоняется в 3D"
    : hasVario
      ? "Ведите мышью — наклон; влево/вправо — лицо и оборот"
      : "Ведите мышью — карточка наклоняется";

  return (
    <div
      className="pointer-events-none absolute bottom-3 left-1/2 z-[45] flex max-w-[min(94%,320px)] -translate-x-1/2 flex-col items-center gap-1 rounded-2xl border border-violet-400/35 bg-black/80 px-3 py-2 text-center shadow-[0_10px_40px_rgba(0,0,0,0.55)] backdrop-blur-md sm:bottom-4"
      role="status"
    >
      <div className="flex items-center gap-2 text-left text-[11px] font-medium leading-snug text-white/95 sm:text-xs">
        <Move3d
          className="text-violet-300 animate-card-hint-icon h-4 w-4 shrink-0"
          aria-hidden
        />
        <span>{line}</span>
      </div>
    </div>
  );
}
