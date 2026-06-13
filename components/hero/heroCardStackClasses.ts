/**
 * Единая строка классов для героя — и SSR, и клиент должны совпадать побайтово,
 * иначе Next покажет hydration mismatch на CardStackVisual.
 */

/**
 * Ширина стопки: `w-full` обязателен — иначе при сбое разбора длинного `w-[min(...)]]` в Tailwind блок схлопывается в 0.
 * Ограничение справа — только `max-w` (без вложенного min(dvh) в arbitrary, ломало сборку/рендер).
 */
/** Ширина стопки в герое — без max-width (как крупное превью на странице товара). */
export const HERO_CARD_STACK_WIDTH_MATCH_CLASS = "hero-stack-max w-full";

/** Новинки в герое — та же полная ширина колонки. */
export const HERO_CARD_STACK_WIDTH_NOVELTY_NARROW_CLASS = "hero-stack-max w-full";

/** Рамка каталога: 2:3 / TMNT 761×1024 / баннер 16/6 — см. `resolveCatalogCardArtBoxAspectCss`. */
export function heroCardStackRootClass(): string {
  return "relative w-full max-w-full overflow-visible rounded-2xl";
}

/**
 * Обёртка-кнопки героя: `block` + `w-full` + `max-w` — при `lg:justify-end` у родителя правый край закреплён.
 */
export const HERO_CARD_STACK_BUTTON_CLASS =
  `group/cardstack relative block ${HERO_CARD_STACK_WIDTH_MATCH_CLASS} shrink-0 cursor-pointer overflow-visible border-0 bg-transparent p-0 text-left`;

export const HERO_CARD_STACK_BUTTON_CLASS_NOVELTY_NARROW =
  `group/cardstack relative block ${HERO_CARD_STACK_WIDTH_NOVELTY_NARROW_CLASS} shrink-0 cursor-pointer overflow-visible border-0 bg-transparent p-0 text-left`;
