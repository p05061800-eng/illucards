"use client";

import { useCallback, useRef, type TouchEvent } from "react";
import { isCardLinkTap, isCardTiltDrag, touchPoint } from "./cardLinkTap";

type Options = {
  shouldIgnoreTarget?: (target: EventTarget | null) => boolean;
};

/** Тап — переход; сдвиг пальца — 3D/vario (не открывать карточку). */
export function useCardLinkTouchNav(
  onNavigate: () => void,
  options?: Options,
) {
  const shouldIgnore = options?.shouldIgnoreTarget;
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchDragRef = useRef(false);
  const touchNavigatedRef = useRef(false);

  const onTouchStartCapture = useCallback(
    (e: TouchEvent<HTMLElement>) => {
      if (shouldIgnore?.(e.target)) return;
      touchNavigatedRef.current = false;
      touchDragRef.current = false;
      if (e.touches.length === 0) return;
      touchStartRef.current = touchPoint(e.touches[0]!);
    },
    [shouldIgnore],
  );

  const onTouchMoveCapture = useCallback(
    (e: TouchEvent<HTMLElement>) => {
      if (shouldIgnore?.(e.target)) return;
      const start = touchStartRef.current;
      if (!start || touchDragRef.current || e.touches.length === 0) return;
      const pt = touchPoint(e.touches[0]!);
      if (isCardTiltDrag(start, pt)) {
        touchDragRef.current = true;
      }
    },
    [shouldIgnore],
  );

  const onTouchEnd = useCallback(
    (e: TouchEvent<HTMLElement>) => {
      if (shouldIgnore?.(e.target)) {
        touchStartRef.current = null;
        return;
      }
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start || e.changedTouches.length === 0) return;
      if (touchDragRef.current) {
        e.preventDefault();
        touchDragRef.current = false;
        return;
      }
      const end = touchPoint(e.changedTouches[0]!);
      if (!isCardLinkTap(start, end)) return;
      e.preventDefault();
      touchNavigatedRef.current = true;
      onNavigate();
    },
    [onNavigate, shouldIgnore],
  );

  const onTouchCancel = useCallback(() => {
    touchStartRef.current = null;
    touchDragRef.current = false;
  }, []);

  const consumeTouchNavigationClick = useCallback(() => {
    if (!touchNavigatedRef.current) return false;
    touchNavigatedRef.current = false;
    return true;
  }, []);

  return {
    onTouchStartCapture,
    onTouchMoveCapture,
    onTouchEnd,
    onTouchCancel,
    consumeTouchNavigationClick,
  };
}
