/** Допуск смещения при тапе по карточке (переход на страницу товара). */
export const CARD_LINK_TAP_MAX_PX = 28;

/**
 * Vario/наклон на таче начинается только после этого сдвига.
 * Должен быть ≥ CARD_LINK_TAP_MAX_PX, иначе короткий тап «съедается» 3D и страница не открывается.
 */
export const CARD_TILT_DRAG_MIN_PX = CARD_LINK_TAP_MAX_PX;

export function isCardLinkTap(
  start: { x: number; y: number },
  end: { x: number; y: number },
): boolean {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  return dx <= CARD_LINK_TAP_MAX_PX && dy <= CARD_LINK_TAP_MAX_PX;
}

export function isCardTiltDrag(
  start: { x: number; y: number },
  current: { x: number; y: number },
): boolean {
  const dx = Math.abs(current.x - start.x);
  const dy = Math.abs(current.y - start.y);
  return dx > CARD_TILT_DRAG_MIN_PX || dy > CARD_TILT_DRAG_MIN_PX;
}

export function touchPoint(t: { clientX: number; clientY: number }): {
  x: number;
  y: number;
} {
  return { x: t.clientX, y: t.clientY };
}
