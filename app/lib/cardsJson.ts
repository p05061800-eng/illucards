import type {
  CardEffectKind,
  CardReview,
  CardStats,
  StoredCard,
} from "@/app/api/cards/route";
import {
  BERSERK_REFERENCE_POSTER_DIMENSIONS,
  isBerserkCategory,
  isFixedCardArtFramePreset,
  parseCardArtFramePreset,
  TMNT_REFERENCE_POSTER_DIMENSIONS,
} from "@/app/lib/cardAspectRatio";
import {
  canonicalRarityFromTags,
  normalizeRarityArrayFromJson,
  parseCardRarity,
} from "@/app/lib/cardRarityTags";
import {
  parseNoveltySinceMs,
  withoutExpiredNovelty,
} from "@/app/lib/noveltyExpiry";
import { parseImageFocus } from "@/app/lib/imageFocus";
import {
  isSafeImageUrl,
  isSafeUploadPublicPath,
  isSafeVercelBlobUrl,
} from "@/app/lib/serverImage";
import { publicCdnUploadUrl } from "@/app/lib/publicCdnUploadUrl";

const DEFAULT_STATS: CardStats = {
  power: 50,
  speed: 50,
  intelligence: 50,
  magic: 50,
};

function normalizeCardEffect(raw: unknown): CardEffectKind {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "vario") return "vario";
  if (s === "morphing") return "morphing";
  return "3d-horizontal";
}

function clampStat(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseCardFlag(raw: unknown): boolean {
  if (raw === true) return true;
  if (raw === false) return false;
  if (typeof raw === "string") {
    const s = raw.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "on";
  }
  return false;
}

function parseStats(raw: unknown): CardStats {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return {
      power: clampStat(Number(o.power)),
      speed: clampStat(Number(o.speed)),
      intelligence: clampStat(Number(o.intelligence)),
      magic: clampStat(Number(o.magic)),
    };
  }
  return { ...DEFAULT_STATS };
}

function parsePrice(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, raw);
  }
  if (typeof raw === "string") {
    const n = parseFloat(raw.replace(",", "."));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  return 0;
}

function parseOptionalPriceRub(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  if (s === "") return undefined;
  const n = parsePrice(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.min(99999999, Math.round(n));
}

function isSafeFrontHoverMotionPath(p: string): boolean {
  const t = p.trim().toLowerCase();
  const isVideoExt =
    t.endsWith(".mp4") ||
    t.endsWith(".webm") ||
    t.endsWith(".mov") ||
    t.endsWith(".m4v");
  if (!isVideoExt) return false;
  if (isSafeVercelBlobUrl(p)) return true;
  if (!isSafeUploadPublicPath(p)) return false;
  return (
    t.startsWith("/uploads/videos/") || t.startsWith("/api/media/videos/")
  );
}

function isSafeVideoUrl(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (isSafeUploadPublicPath(t)) return true;
  try {
    const u = new URL(t);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function parseRatingAvg(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.min(5, Math.max(0, Math.round(raw * 10) / 10));
  }
  if (typeof raw === "string") {
    const n = parseFloat(raw.replace(",", "."));
    if (Number.isFinite(n)) {
      return Math.min(5, Math.max(0, Math.round(n * 10) / 10));
    }
  }
  return 5;
}

function parsePositiveDimension(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.round(raw);
    if (n > 0 && n <= 65535) return n;
  }
  if (typeof raw === "string" && raw.trim()) {
    const n = parseInt(raw.trim(), 10);
    if (Number.isFinite(n) && n > 0 && n <= 65535) return n;
  }
  return undefined;
}

/** Ссылка карточки: внутренний путь или http(s). Пустое / некорректное — undefined. */
export function parseOptionalCardHref(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  if (s.includes("\\") || s.includes("..")) return undefined;
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try {
    const u = new URL(s);
    if (u.protocol === "http:" || u.protocol === "https:") return s;
  } catch {
    /* ignore */
  }
  return undefined;
}

function parseCategoryOrder(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n =
    typeof raw === "number" ? raw : parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(999999, Math.max(0, Math.floor(n)));
}

function parseVarioSmoothing(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n =
    typeof raw === "number" ? raw : parseFloat(String(raw).trim());
  if (!Number.isFinite(n)) return undefined;
  return Math.min(0.6, Math.max(0.05, n));
}

function parseReviewCount(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.min(999999, Math.floor(raw));
  }
  if (typeof raw === "string") {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0) return Math.min(999999, n);
  }
  return 0;
}

function parseReviews(raw: unknown): CardReview[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: CardReview[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const author = String(o.author ?? "Покупатель").trim() || "Покупатель";
    const text = String(o.text ?? "").trim();
    if (!text) continue;
    const rating = Math.min(
      5,
      Math.max(1, Math.round(Number(o.rating) || 5))
    );
    const date = typeof o.date === "string" ? o.date.trim() : undefined;
    const images: string[] = [];
    if (Array.isArray(o.images)) {
      for (const u of o.images) {
        const s = String(u).trim();
        if (s && isSafeImageUrl(s)) images.push(s);
      }
    }
    const videoRaw = typeof o.video === "string" ? o.video.trim() : "";
    const video =
      videoRaw && isSafeVideoUrl(videoRaw) ? videoRaw : undefined;
    out.push({
      author,
      rating,
      text,
      ...(date ? { date } : {}),
      ...(images.length > 0 ? { images } : {}),
      ...(video ? { video } : {}),
    });
  }
  return out.length > 0 ? out : undefined;
}

function parseIdList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = raw
    .map((x) => String(x).trim())
    .filter((s) => s.length > 0);
  return ids.length > 0 ? ids : undefined;
}

function normalizeCard(raw: Record<string, unknown>): StoredCard {
  const legacy =
    typeof raw.image === "string" && raw.image.length > 0 ? raw.image : "";
  const front =
    typeof raw.frontImage === "string" && raw.frontImage.length > 0
      ? raw.frontImage
      : legacy;
  const rawBackFull =
    typeof raw.backImage === "string" && raw.backImage.length > 0
      ? raw.backImage.trim()
      : "";
  const effectRaw =
    typeof raw.effect === "string" ? raw.effect.trim() : "";
  const effectFromJson = effectRaw ? normalizeCardEffect(effectRaw) : null;
  const effect: CardEffectKind =
    effectFromJson ??
    (rawBackFull && rawBackFull !== front ? "vario" : "3d-horizontal");

  let back = "";
  if (effect === "vario" || effect === "morphing") {
    back = rawBackFull || front;
  }

  const reviewsParsed = parseReviews(raw.reviews);
  const reviewCountRaw = parseReviewCount(raw.reviewCount);
  const countFromReviews = reviewsParsed?.length ?? 0;
  const tagsMulti = normalizeRarityArrayFromJson(raw.rarities);
  const singular = parseCardRarity(raw.rarity);
  const rarityTagsRaw =
    tagsMulti && tagsMulti.length > 0 ? tagsMulti : [singular];
  const noveltySinceRaw =
    typeof raw.noveltySince === "string" && raw.noveltySince.trim()
      ? raw.noveltySince.trim()
      : parseNoveltySinceMs(raw.noveltySince) != null
        ? new Date(parseNoveltySinceMs(raw.noveltySince)!).toISOString()
        : undefined;
  const timing = {
    noveltySince: noveltySinceRaw,
    frontImage: front,
  };
  const rarityTags = withoutExpiredNovelty(rarityTagsRaw, timing);
  const rarityValue = canonicalRarityFromTags(
    rarityTags.length > 0 ? rarityTags : ["common"],
  );
  const card: StoredCard = {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    category:
      typeof raw.category === "string" ? raw.category : "",
    subcategory:
      typeof raw.subcategory === "string" ? raw.subcategory.trim() : "",
    frontImage: publicCdnUploadUrl(front),
    backImage: back ? publicCdnUploadUrl(back) : back,
    price: parsePrice(raw.priceByn ?? raw.price),
    rarity: rarityValue,
    stats: parseStats(raw.stats),
    isNew: parseCardFlag(raw.isNew),
    isPopular: parseCardFlag(raw.isPopular),
    isSale: parseCardFlag(raw.isSale),
    inStock:
      raw.inStock === undefined ? true : parseCardFlag(raw.inStock),
    ratingAvg: parseRatingAvg(raw.ratingAvg),
    reviewCount:
      reviewCountRaw > 0
        ? reviewCountRaw
        : countFromReviews > 0
          ? countFromReviews
          : 0,
  };
  if (rarityTags.length > 1) {
    card.rarities = rarityTags;
  }
  if (noveltySinceRaw) {
    card.noveltySince = noveltySinceRaw;
  }
  if (reviewsParsed) {
    card.reviews = reviewsParsed;
  }
  const pv =
    typeof raw.productVideo === "string" ? raw.productVideo.trim() : "";
  if (pv && isSafeVideoUrl(pv)) {
    card.productVideo = publicCdnUploadUrl(pv);
  }
  const hg =
    typeof raw.frontHoverGif === "string" ? raw.frontHoverGif.trim() : "";
  if (hg && isSafeFrontHoverMotionPath(hg)) {
    card.frontHoverGif = publicCdnUploadUrl(hg);
  }
  const bt = parseIdList(raw.boughtTogetherIds);
  if (bt) {
    card.boughtTogetherIds = bt;
  }
  const rec = parseIdList(raw.recommendedIds);
  if (rec) {
    card.recommendedIds = rec;
  }
  card.effect = effect;
  const bgRaw = typeof raw.bg === "string" ? raw.bg.trim() : "";
  if (bgRaw) {
    card.bg = bgRaw;
  }
  const categoryBgRaw =
    typeof raw.categoryBg === "string" ? raw.categoryBg.trim() : "";
  const legacyBgImage =
    typeof raw.bgImage === "string" ? raw.bgImage.trim() : "";
  if (categoryBgRaw) {
    card.categoryBg = publicCdnUploadUrl(categoryBgRaw);
  } else if (legacyBgImage) {
    card.categoryBg = publicCdnUploadUrl(legacyBgImage);
  }
  const heroBgRaw = typeof raw.heroBg === "string" ? raw.heroBg.trim() : "";
  if (heroBgRaw) {
    card.heroBg = publicCdnUploadUrl(heroBgRaw);
  }
  const ultraBgRaw = typeof raw.ultraBg === "string" ? raw.ultraBg.trim() : "";
  if (ultraBgRaw) {
    card.ultraBg = publicCdnUploadUrl(ultraBgRaw);
  }
  const ff = parseImageFocus(raw.frontImageFocus);
  if (ff) {
    card.frontImageFocus = ff;
  }
  const bf = parseImageFocus(raw.backImageFocus);
  if (bf) {
    card.backImageFocus = bf;
  }
  const midImg =
    typeof raw.middleImage === "string" ? raw.middleImage.trim() : "";
  if (midImg) {
    card.middleImage = publicCdnUploadUrl(midImg);
  }
  const mf = parseImageFocus(raw.middleImageFocus);
  if (mf && card.middleImage?.trim()) {
    card.middleImageFocus = mf;
  }
  const cf = parseImageFocus(raw.categoryBgFocus);
  if (cf) {
    card.categoryBgFocus = cf;
  }
  const vf = parseImageFocus(raw.productVideoFocus);
  if (vf && card.productVideo?.trim()) {
    card.productVideoFocus = vf;
  }
  const prub = parseOptionalPriceRub(raw.priceRub);
  if (prub !== undefined) {
    card.priceRub = prub;
  }
  const co = parseCategoryOrder(raw.categoryOrder);
  if (co !== undefined) {
    card.categoryOrder = co;
  }
  if (parseCardFlag(raw.varioSmoothBlend) && effect !== "morphing") {
    card.varioSmoothBlend = true;
  }
  const vs = parseVarioSmoothing(raw.varioSmoothing);
  if (vs !== undefined) {
    card.varioSmoothing = vs;
  }
  const fiw = parsePositiveDimension(raw.frontImageWidth);
  const fih = parsePositiveDimension(raw.frontImageHeight);
  if (fiw && fih) {
    card.frontImageWidth = fiw;
    card.frontImageHeight = fih;
  }
  if (card.category?.trim() === "TMNT") {
    card.frontImageWidth = TMNT_REFERENCE_POSTER_DIMENSIONS.width;
    card.frontImageHeight = TMNT_REFERENCE_POSTER_DIMENSIONS.height;
  } else if (isBerserkCategory(card.category)) {
    card.frontImageWidth = BERSERK_REFERENCE_POSTER_DIMENSIONS.width;
    card.frontImageHeight = BERSERK_REFERENCE_POSTER_DIMENSIONS.height;
  }
  const framePreset = parseCardArtFramePreset(raw.cardArtFramePreset);
  if (isFixedCardArtFramePreset(framePreset)) {
    card.cardArtFramePreset = framePreset;
  }
  const href = parseOptionalCardHref(raw.href);
  if (href) {
    card.href = href;
  }
  return card;
}

/** Карточки без файлов картинок в хранилище (чёрные заглушки на сайте). */
const MISSING_MEDIA_CARD_IDS = new Set([
  "aa205736-a440-4d40-9fdf-79a5ec082362",
  "cd17a026-965b-420c-b9a1-d7dadb318d62",
  "4fb97a73-bbdd-4c9b-8c2e-4d1568adab96",
  "0a2d61ce-641a-4379-84b1-cb7b2449fa1f",
]);

export function parseCardsJson(json: string): StoredCard[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeCard(item as Record<string, unknown>))
      .filter(
        (card) =>
          Boolean(card.frontImage?.trim()) &&
          !MISSING_MEDIA_CARD_IDS.has(card.id),
      );
  } catch {
    return [];
  }
}

/** Главная не тащит описания и отзывы в клиентский бандл. */
export function toStorefrontCard(card: StoredCard): StoredCard {
  return {
    ...card,
    description: "",
    reviews: undefined,
    boughtTogetherIds: undefined,
    recommendedIds: undefined,
    productVideo: undefined,
    productVideoFocus: undefined,
  };
}
