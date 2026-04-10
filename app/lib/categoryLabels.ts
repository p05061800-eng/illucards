import { categories } from "../../data/categories";

/** Старые значения `category` из админки / данных → отображаемое имя */
const LEGACY_CATEGORY_DISPLAY: Record<string, string> = {
  "spider-man": "Marvel",
  tmnt: "TMNT",
  "stranger-things": "Stranger Things",
  "Очень странные дела": "Stranger Things",
  pokemon: "Pokemon",
  cars: "Cars",
  football: "Football",
  anime: "Anime",
  marvel: "Marvel",
  dc: "DC",
};

/** Человекочитаемый заголовок категории (страница / таблица) */
export function categoryLabel(category: string): string {
  const c = category?.trim() ?? "";
  if (c === "") return "Без категории";
  if (categories.some((x) => x.name === c)) return c;
  return LEGACY_CATEGORY_DISPLAY[c] ?? c;
}
