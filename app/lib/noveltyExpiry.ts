import type { CardRarity } from "@/app/lib/cardRarityTags";

/** Срок показа метки «Новинки» на карточке (30 дней). */
export const NOVELTY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type NoveltyTimingSource = {
  noveltySince?: unknown;
  frontImage?: string;
};

export function parseNoveltySinceMs(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  if (typeof raw === "string" && raw.trim()) {
    const t = Date.parse(raw.trim());
    if (Number.isFinite(t) && t > 0) return t;
  }
  return undefined;
}

/** Время из имени файла `/uploads/1776101984000-….webp` — для карточек без noveltySince. */
export function inferNoveltySinceMsFromUploadPath(
  frontImage: unknown,
): number | undefined {
  if (typeof frontImage !== "string" || !frontImage.trim()) return undefined;
  const m = frontImage.match(/\/uploads\/(\d{10,})-/);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n < 1e12 ? Math.floor(n * 1000) : Math.floor(n);
}

export function resolveNoveltySinceMs(card: NoveltyTimingSource): number | undefined {
  return (
    parseNoveltySinceMs(card.noveltySince) ??
    inferNoveltySinceMsFromUploadPath(card.frontImage)
  );
}

export function isNoveltyActive(
  card: NoveltyTimingSource,
  now = Date.now(),
): boolean {
  const since = resolveNoveltySinceMs(card);
  if (since == null) return true;
  return now - since < NOVELTY_TTL_MS;
}

export function withoutExpiredNovelty(
  tags: readonly CardRarity[],
  card: NoveltyTimingSource,
  now = Date.now(),
): CardRarity[] {
  if (!tags.includes("novelty")) return [...tags];
  if (isNoveltyActive(card, now)) return [...tags];
  return tags.filter((t) => t !== "novelty");
}

export function noveltySinceIsoNow(): string {
  return new Date().toISOString();
}

/** При сохранении в админке: новая «новинка» → now; продление после истечения → снова now. */
export function resolveNoveltySinceOnAdminSave(
  existing: NoveltyTimingSource | null | undefined,
  newTags: readonly CardRarity[],
): string | undefined {
  if (!newTags.includes("novelty")) return undefined;
  if (existing?.noveltySince && isNoveltyActive(existing)) {
    const raw =
      typeof existing.noveltySince === "string"
        ? existing.noveltySince.trim()
        : "";
    if (raw) return raw;
  }
  return noveltySinceIsoNow();
}
