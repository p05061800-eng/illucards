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

export type CardCatalogPriceFields = CardRaritySource & {
  price?: number;
  priceByn?: number;
};

function cardHasExplicitCatalogPrice(card: CardCatalogPriceFields): boolean {
  if (card.priceByn != null && Number.isFinite(card.priceByn) && card.priceByn > 0) {
    return true;
  }
  if (card.price != null && Number.isFinite(card.price) && card.price > 0) {
    return true;
  }
  return false;
}

/**
 * Фиксированная цена 18+ — только если в каталоге не задана своя цена.
 * Лимитированные карточки с меткой 18+ сохраняют цену из админки.
 */
export function cardUsesAdultFixedPricing(card: CardCatalogPriceFields): boolean {
  if (!cardHasRarityTag(card, "adult")) return false;
  return !cardHasExplicitCatalogPrice(card);
}

/** @deprecated Используйте `cardUsesAdultFixedPricing` (цена) или `cardHasRarityTag(card, "adult")` (размытие). */
export function cardTreatsAsAdultPricing(card: CardRaritySource): boolean {
  return cardUsesAdultFixedPricing(card);
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
