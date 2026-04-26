/**
 * Несколько меток редкости на карточке (`rarities` в JSON) + одно поле `rarity`
 * как каноническое значение для обратной совместимости.
 */

export type CardRarity =
  | "common"
  | "limited"
  | "adult"
  | "replica"
  | "novelty"
  | "hot_price";

const RARITIES: CardRarity[] = [
  "common",
  "limited",
  "adult",
  "replica",
  "novelty",
  "hot_price",
];

const LEGACY_RARITY: Record<string, CardRarity> = {
  rare: "novelty",
  epic: "hot_price",
  legendary: "limited",
};

/** Порядок канона для поля `rarity`: adult > hot_price > limited > novelty > replica > common */
const CANONICAL_PRIORITY: CardRarity[] = [
  "adult",
  "hot_price",
  "limited",
  "novelty",
  "replica",
  "common",
];

export function parseCardRarity(raw: unknown): CardRarity {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (RARITIES.includes(s as CardRarity)) return s as CardRarity;
  return LEGACY_RARITY[s] ?? "limited";
}

export function normalizeRarityArrayFromJson(raw: unknown): CardRarity[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: CardRarity[] = [];
  for (const x of raw) {
    const r = parseCardRarity(x);
    if (!out.includes(r)) out.push(r);
  }
  return out.length > 0 ? out : undefined;
}

export function canonicalRarityFromTags(tags: CardRarity[]): CardRarity {
  const uniq = [...new Set(tags)].filter(Boolean);
  if (uniq.length === 0) return "limited";
  for (const p of CANONICAL_PRIORITY) {
    if (uniq.includes(p)) return p;
  }
  return uniq[0]!;
}

export type CardRaritySource = {
  rarity?: string;
  rarities?: readonly string[] | readonly CardRarity[];
};

/** Все активные теги редкости (из `rarities` или одно поле `rarity`). */
export function cardRarityTags(card: CardRaritySource): CardRarity[] {
  const fromArr = normalizeRarityArrayFromJson(card.rarities as unknown);
  if (fromArr?.length) return fromArr;
  return [parseCardRarity(card.rarity)];
}

export function cardHasRarityTag(card: CardRaritySource, tag: CardRarity): boolean {
  return cardRarityTags(card).includes(tag);
}

/** Фиксированная цена 18+ — если среди тегов есть adult. */
export function cardTreatsAsAdultPricing(card: CardRaritySource): boolean {
  return cardHasRarityTag(card, "adult");
}

/** Размытие / подтверждение возраста только для метки 18+ (`adult`). */
export function cardRequiresAgeConfirmationFromTags(card: CardRaritySource): boolean {
  return cardHasRarityTag(card, "adult");
}

const RU_LABELS: Record<CardRarity, string> = {
  common: "Обычная",
  limited: "Лимитированная",
  adult: "18+",
  replica: "Реплики",
  novelty: "Новинки",
  hot_price: "Горячая цена",
};

/** Подпись в каталоге: все выбранные редкости через « · ». */
export function formatRarityLabelsRu(card: CardRaritySource): string {
  return cardRarityTags(card)
    .map((r) => RU_LABELS[r])
    .join(" · ");
}

/** Ключ стиля бейджа: при наличии 18+ — розовый акцент. */
export function primaryRarityForUi(card: CardRaritySource): CardRarity {
  const t = cardRarityTags(card);
  if (t.includes("adult")) return "adult";
  return t[0] ?? "limited";
}
