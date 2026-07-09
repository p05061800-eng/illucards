/** Сохранить и вернуть scrollY страницы (автокарусели в герое не должны двигать окно). */
export function capturePageScrollY(): number {
  if (typeof window === "undefined") return 0;
  return window.scrollY;
}

export function restorePageScrollY(y: number): void {
  if (typeof window === "undefined" || !Number.isFinite(y) || y < 0) return;
  if (window.scrollY === y) return;

  window.scrollTo({ top: y, left: 0, behavior: "auto" });
  requestAnimationFrame(() => {
    if (window.scrollY !== y) {
      window.scrollTo({ top: y, left: 0, behavior: "auto" });
    }
  });
}

export function restorePageScrollAfterLayoutChange(
  savedY: number,
  layoutDelta: number,
): void {
  if (Math.abs(layoutDelta) < 0.5) {
    restorePageScrollY(savedY);
    return;
  }
  restorePageScrollY(savedY + layoutDelta);
}
