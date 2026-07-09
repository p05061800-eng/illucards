/** Допуск смещения пальца при тапе по карточке (переход на страницу товара). */
export const CARD_LINK_TAP_MAX_PX = 22;

/** Минимальный сдвиг, после которого жест считается «крутить карточку», а не тапом. */
export const CARD_TILT_DRAG_MIN_PX = 10;

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
