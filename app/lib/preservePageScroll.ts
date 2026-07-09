/** Сохранить и вернуть scrollY страницы (автокарусели в герое не должны двигать окно). */
export function capturePageScrollY(): number {
  if (typeof window === "undefined") return 0;
  return window.scrollY;
}

export function restorePageScrollY(y: number): void {
  if (typeof window === "undefined" || !Number.isFinite(y) || y < 0) return;

  const apply = () => {
    if (window.scrollY !== y) {
      window.scrollTo({ top: y, left: 0, behavior: "auto" });
    }
  };

  apply();
  requestAnimationFrame(apply);
  requestAnimationFrame(() => requestAnimationFrame(apply));
  window.setTimeout(apply, 0);
  window.setTimeout(apply, 50);
  window.setTimeout(apply, 150);
}

/** Сдвиг scrollY на delta после изменения высоты блока выше текущей позиции. */
export function compensatePageScrollY(delta: number): void {
  if (typeof window === "undefined" || !Number.isFinite(delta) || Math.abs(delta) < 0.5) {
    return;
  }
  const next = Math.max(0, window.scrollY + delta);
  restorePageScrollY(next);
}

export function restorePageScrollAfterLayoutChange(
  savedY: number,
  layoutDelta: number,
): void {
  restorePageScrollY(savedY + layoutDelta);
}
