/**
 * Единая строка классов для героя — и SSR, и клиент должны совпадать побайтово,
 * иначе Next покажет hydration mismatch на CardStackVisual.
 */
/** Без `w-full` внутри `w-fit` у кнопки — иначе ширина может стать 0 и карточка пропадает */
/** Ширина стопки в герое — совпадает с `HERO_CARD_STACK_ROOT_CLASS` (для стрелок под карточкой). */
export const HERO_CARD_STACK_WIDTH_MATCH_CLASS =
  "w-[260px] max-w-[min(100%,calc(100vw-2rem))] sm:w-[300px] lg:w-[360px]";

export const HERO_CARD_STACK_ROOT_CLASS =
  "relative mx-auto aspect-[3/4] w-[260px] max-w-[min(100%,calc(100vw-2rem))] overflow-visible rounded-2xl sm:w-[300px] lg:w-[360px]";

/** Обёртка-кнопка героя: одна строка для SSR и клиента (включая `shrink-0`). */
export const HERO_CARD_STACK_BUTTON_CLASS =
  "group/cardstack relative flex w-fit shrink-0 cursor-pointer items-center justify-center overflow-visible border-0 bg-transparent p-0 text-left";
