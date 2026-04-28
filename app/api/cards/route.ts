import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { parseCardsJson } from "@/app/lib/cardsJson";
import type { ImageFocus } from "@/app/lib/imageFocus";
import { parseImageFocusJson } from "@/app/lib/imageFocus";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { maxCategoryOrderInCategory } from "@/app/lib/adminCategoryOrder";
import {
  imageBufferTo34Webp,
  imageBufferToTmntPosterWebp,
  isSafeUploadPublicPath,
} from "@/app/lib/serverImage";
import { readPublicImageDimensions } from "@/app/lib/readPublicImageDimensions";
import {
  isFixedCardArtFramePreset,
  parseCardArtFramePreset,
  TMNT_REFERENCE_POSTER_DIMENSIONS,
  type CardArtFramePreset,
} from "@/app/lib/cardAspectRatio";
import {
  canonicalRarityFromTags,
  normalizeRarityArrayFromJson,
  parseCardRarity,
  type CardRarity,
} from "@/app/lib/cardRarityTags";

export type { CardRarity } from "@/app/lib/cardRarityTags";

const DATA_PATH = path.join(process.cwd(), "data", "cards.json");
const UPLOAD_PUBLIC = path.join(process.cwd(), "public", "uploads");

async function ensureStorage() {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.mkdir(UPLOAD_PUBLIC, { recursive: true });
}

/** Vario / Morphing (две картинки) или 3D (лицевая + наклон без смены сторон). */
export type CardEffectKind = "vario" | "morphing" | "3d-horizontal";

function normalizeCardEffect(raw: unknown): CardEffectKind {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "vario") return "vario";
  if (s === "morphing") return "morphing";
  return "3d-horizontal";
}

function parseRaritiesFromFormData(formData: FormData): CardRarity[] {
  const j = String(formData.get("rarities") ?? "").trim();
  if (j) {
    try {
      const parsed = JSON.parse(j) as unknown;
      const arr = normalizeRarityArrayFromJson(parsed);
      if (arr?.length) return arr;
    } catch {
      /* ignore */
    }
  }
  return [parseCardRarity(formData.get("rarity"))];
}

function parseStatField(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return clampStat(raw);
  }
  if (typeof raw === "string") {
    const n = parseFloat(raw.replace(",", "."));
    return Number.isFinite(n) ? clampStat(n) : 50;
  }
  return 50;
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

export type CardStats = {
  power: number;
  speed: number;
  intelligence: number;
  magic: number;
};

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

export type CardReview = {
  author: string;
  rating: number;
  text: string;
  date?: string;
  /** URL в `/uploads/...` (из админки или загрузки). */
  images?: string[];
  /** URL видео (`/uploads/...` или https). */
  video?: string;
  /** Несколько роликов в одном отзыве. */
  videos?: string[];
};

export type StoredCard = {
  id: string;
  title: string;
  description: string;
  /** Тематика витрины: marvel, tmnt, anime и т.д. */
  category: string;
  /** Уточнение: spiderman, naruto и т.д. */
  subcategory: string;
  frontImage: string;
  backImage: string;
  /** Vario: необязательная «средняя» картинка между лицом и оборотом. */
  middleImage?: string;
  /** Tailwind-классы градиента для hero (например from-red-900 via-black to-orange-900). */
  bg?: string;
  /** Фон категории в hero (слой под картами). */
  categoryBg?: string;
  /** Полноэкранный размытый фон hero для карточки. */
  heroBg?: string;
  /** Самый дальний слой фона hero (за heroBg). */
  ultraBg?: string;
  /**
   * Анимация при наведении на лицо в 3D-витрине (тот же кадр, что лицевая картинка):
   * MP4/WebM/MOV в `/uploads/videos/` (GIF не поддерживаются).
   */
  frontHoverGif?: string;
  /** Видео товара (URL mp4/webm или загрузка в /uploads/). */
  productVideo?: string;
  /** Кадр видео в плеере (`object-fit: cover` + object-position), любое соотношение сторон исходника. */
  productVideoFocus?: ImageFocus;
  /** В наличии на витрине. */
  inStock: boolean;
  /** Средняя оценка 0–5. */
  ratingAvg: number;
  /** Число отзывов (если не задано — берётся из reviews). */
  reviewCount: number;
  /** Отзывы на странице товара. */
  reviews?: CardReview[];
  /** id карточек «вместе покупают». */
  boughtTogetherIds?: string[];
  /** id рекомендуемых карточек. */
  recommendedIds?: string[];
  /** Флаги витрины для фильтра каталога. */
  isNew: boolean;
  isPopular: boolean;
  isSale: boolean;
  /** Базовая валюта — BYN. */
  price: number;
  /** Цена в рублях РФ для витрины (если не задана — BYN × курс на клиенте). */
  priceRub?: number;
  rarity: CardRarity;
  /** Несколько меток редкости (если одна — поле не пишется, только `rarity`). */
  rarities?: CardRarity[];
  stats: CardStats;
  effect?: string;
  /** Пиксели лица на диске (заполняется API при сохранении) — рамка без клиентского замера. */
  frontImageWidth?: number;
  frontImageHeight?: number;
  /** Рамка витрины: по файлу | жёстко 681×1024 | жёстко 600×900. */
  cardArtFramePreset?: CardArtFramePreset;
  /** Фокус кадра при cover: лицо (0–100 %). */
  frontImageFocus?: ImageFocus;
  /** Фокус кадра при cover: оборот (Vario). */
  backImageFocus?: ImageFocus;
  /** Фокус кадра: средняя сторона (Vario). */
  middleImageFocus?: ImageFocus;
  /** Фокус для фона категории (слой в витрине). */
  categoryBgFocus?: ImageFocus;
  /** Порядок в категории на главной (меньше — раньше). Только админка + сортировка каталога. */
  categoryOrder?: number;
  /**
   * Vario: плавно смешивать три слоя (ultra + оборот + лицо) по горизонтали курсора.
   * Если false — только лицо/оборот как раньше; ultra всегда непрозрачен.
   */
  varioSmoothBlend?: boolean;
  /** Vario: инерция курсора 0.05–0.6 (выше — быстрее догоняет). */
  varioSmoothing?: number;
};

function isSafeFrontHoverMotionPath(p: string): boolean {
  const t = p.trim().toLowerCase();
  if (!isSafeUploadPublicPath(p)) return false;
  if (!t.startsWith("/uploads/videos/")) return false;
  return (
    t.endsWith(".mp4") ||
    t.endsWith(".webm") ||
    t.endsWith(".mov") ||
    t.endsWith(".m4v")
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
        if (s && isSafeUploadPublicPath(s)) images.push(s);
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

function parseIdListFromComma(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type CardImageSavePipeline = "card34" | "tmntPoster";

async function saveImageFile(
  file: File,
  pipeline: CardImageSavePipeline = "card34",
): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const processed =
    pipeline === "tmntPoster"
      ? await imageBufferToTmntPosterWebp(buffer)
      : await imageBufferTo34Webp(buffer);
  const filename = `${randomUUID()}.webp`;
  await fs.writeFile(path.join(UPLOAD_PUBLIC, filename), processed);
  return `/uploads/${filename}`;
}

async function resolveUploadedImage(
  formData: FormData,
  urlKey: string,
  fileKey: string,
  pipeline: CardImageSavePipeline = "card34",
): Promise<string | null> {
  const urlRaw = String(formData.get(urlKey) ?? "").trim();
  if (urlRaw && isSafeUploadPublicPath(urlRaw)) {
    return urlRaw;
  }
  const file = formData.get(fileKey);
  if (file instanceof File && file.size > 0) {
    return saveImageFile(file, pipeline);
  }
  return null;
}

async function readCards(): Promise<StoredCard[]> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    return parseCardsJson(raw);
  } catch {
    return [];
  }
}

export async function GET() {
  await ensureStorage();
  const cards = await readCards();
  return NextResponse.json(cards);
}

export async function POST(req: NextRequest) {
  await ensureStorage();

  const formData = await req.formData();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const effect = normalizeCardEffect(formData.get("effect"));
  const price = parsePrice(formData.get("price"));
  const rarityTagsPost = parseRaritiesFromFormData(formData);
  const stats: CardStats = {
    power: parseStatField(formData.get("statPower")),
    speed: parseStatField(formData.get("statSpeed")),
    intelligence: parseStatField(formData.get("statIntelligence")),
    magic: parseStatField(formData.get("statMagic")),
  };
  if (!title) {
    return NextResponse.json(
      { error: "Укажите название карточки." },
      { status: 400 }
    );
  }

  const imagePipe: CardImageSavePipeline =
    category === "TMNT" ? "tmntPoster" : "card34";

  const frontImagePath = await resolveUploadedImage(
    formData,
    "frontImageUrl",
    "frontImage",
    imagePipe,
  );
  if (!frontImagePath) {
    return NextResponse.json(
      { error: "Выберите изображение лицевой стороны (загрузите файл)." },
      { status: 400 }
    );
  }

  let backImagePath = "";
  if (effect === "vario" || effect === "morphing") {
    const resolved = await resolveUploadedImage(
      formData,
      "backImageUrl",
      "backImage",
      imagePipe,
    );
    if (!resolved) {
      return NextResponse.json(
        {
          error:
            effect === "morphing"
              ? "Для Morphing нужно второе изображение (крупный герой) — загрузите файл."
              : "Для эффекта Vario нужна оборотная сторона — загрузите второе изображение.",
        },
        { status: 400 }
      );
    }
    backImagePath = resolved;
  }

  let middleImagePath: string | undefined;
  if (effect === "vario") {
    const midRes = await resolveUploadedImage(
      formData,
      "middleImageUrl",
      "middleImage",
      imagePipe,
    );
    if (midRes) {
      middleImagePath = midRes;
    }
  }

  const categoryBgUrlRaw = String(formData.get("categoryBgUrl") ?? "").trim();
  const categoryBgUpload = formData.get("categoryBgFile");
  let categoryBgPath: string | undefined;
  if (categoryBgUrlRaw && isSafeUploadPublicPath(categoryBgUrlRaw)) {
    categoryBgPath = categoryBgUrlRaw;
  } else if (categoryBgUpload instanceof File && categoryBgUpload.size > 0) {
    categoryBgPath = await saveImageFile(
      categoryBgUpload,
      category === "TMNT" ? "tmntPoster" : "card34",
    );
  }

  const cards = await readCards();
  const newCard: StoredCard = {
    id: randomUUID(),
    title,
    description,
    category,
    subcategory: "",
    frontImage: frontImagePath,
    backImage: backImagePath,
    price,
    rarity: canonicalRarityFromTags(rarityTagsPost),
    stats,
    effect,
    isNew: false,
    isPopular: false,
    isSale: false,
    inStock: formData.has("inStock")
      ? parseCardFlag(formData.get("inStock"))
      : true,
    ratingAvg: parseRatingAvg(formData.get("ratingAvg")),
    reviewCount: parseReviewCount(formData.get("reviewCount")),
  };
  const reviewsJsonPost = String(formData.get("reviewsJson") ?? "").trim();
  if (reviewsJsonPost) {
    try {
      const parsed = JSON.parse(reviewsJsonPost) as unknown;
      const r = parseReviews(parsed);
      if (r) {
        newCard.reviews = r;
        if (newCard.reviewCount <= 0) {
          newCard.reviewCount = r.length;
        }
      }
    } catch {
      /* ignore */
    }
  }
  const productVideoPost = String(formData.get("productVideo") ?? "").trim();
  if (productVideoPost && isSafeVideoUrl(productVideoPost)) {
    newCard.productVideo = productVideoPost;
  }
  const hoverGifPost = String(formData.get("frontHoverGifUrl") ?? "").trim();
  if (hoverGifPost && isSafeFrontHoverMotionPath(hoverGifPost)) {
    newCard.frontHoverGif = hoverGifPost;
  }
  const btPost = parseIdListFromComma(
    String(formData.get("boughtTogetherIds") ?? "")
  );
  if (btPost.length) {
    newCard.boughtTogetherIds = btPost;
  }
  const recPost = parseIdListFromComma(
    String(formData.get("recommendedIds") ?? "")
  );
  if (recPost.length) {
    newCard.recommendedIds = recPost;
  }
  if (categoryBgPath) {
    newCard.categoryBg = categoryBgPath;
  }

  const frontFocusPost = parseImageFocusJson(
    String(formData.get("frontImageFocus") ?? "")
  );
  if (frontFocusPost) {
    newCard.frontImageFocus = frontFocusPost;
  }
  if (effect === "vario" || effect === "morphing") {
    const backFocusPost = parseImageFocusJson(
      String(formData.get("backImageFocus") ?? "")
    );
    if (backFocusPost) {
      newCard.backImageFocus = backFocusPost;
    }
    if (effect === "vario" && middleImagePath) {
      newCard.middleImage = middleImagePath;
      const midFocusPost = parseImageFocusJson(
        String(formData.get("middleImageFocus") ?? "")
      );
      if (midFocusPost) {
        newCard.middleImageFocus = midFocusPost;
      }
    }
  }
  const catFocusPost = parseImageFocusJson(
    String(formData.get("categoryBgFocus") ?? "")
  );
  if (catFocusPost && (categoryBgPath || newCard.categoryBg)) {
    newCard.categoryBgFocus = catFocusPost;
  }

  const videoFocusPost = parseImageFocusJson(
    String(formData.get("productVideoFocus") ?? "")
  );
  if (videoFocusPost && newCard.productVideo?.trim()) {
    newCard.productVideoFocus = videoFocusPost;
  }

  const coPost = parseCategoryOrder(formData.get("categoryOrder"));
  if (coPost !== undefined) {
    newCard.categoryOrder = coPost;
  } else {
    newCard.categoryOrder = maxCategoryOrderInCategory(cards, category) + 1;
  }

  const prubPost = parseOptionalPriceRub(formData.get("priceRub"));
  if (prubPost !== undefined) {
    newCard.priceRub = prubPost;
  }

  if (effect === "vario") {
    if (parseCardFlag(formData.get("varioSmoothBlend"))) {
      newCard.varioSmoothBlend = true;
    }
  }
  if (effect === "vario" || effect === "morphing") {
    const vsPost = parseVarioSmoothing(formData.get("varioSmoothing"));
    newCard.varioSmoothing = vsPost ?? 0.18;
  }

  const fdNew = await readPublicImageDimensions(frontImagePath);
  if (category === "TMNT") {
    newCard.frontImageWidth = TMNT_REFERENCE_POSTER_DIMENSIONS.width;
    newCard.frontImageHeight = TMNT_REFERENCE_POSTER_DIMENSIONS.height;
  } else if (fdNew) {
    newCard.frontImageWidth = fdNew.width;
    newCard.frontImageHeight = fdNew.height;
  }

  const framePost = parseCardArtFramePreset(formData.get("cardArtFramePreset"));
  if (isFixedCardArtFramePreset(framePost)) {
    newCard.cardArtFramePreset = framePost;
  }

  if (rarityTagsPost.length > 1) {
    newCard.rarities = rarityTagsPost;
  }

  cards.push(newCard);
  await fs.writeFile(DATA_PATH, JSON.stringify(cards, null, 2), "utf-8");

  return NextResponse.json(newCard);
}

export async function PATCH(req: NextRequest) {
  await ensureStorage();

  const formData = await req.formData();
  const cardId = String(formData.get("cardId") ?? "").trim();
  if (!cardId) {
    return NextResponse.json(
      { error: "Укажите id карточки для обновления." },
      { status: 400 }
    );
  }

  const cards = await readCards();
  const idx = cards.findIndex((c) => c.id === cardId);
  if (idx === -1) {
    return NextResponse.json(
      { error: "Карточка не найдена." },
      { status: 404 }
    );
  }

  const existing = cards[idx];

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const effect = normalizeCardEffect(formData.get("effect"));
  const price = parsePrice(formData.get("price"));
  const rarityTagsPatch = parseRaritiesFromFormData(formData);
  const stats: CardStats = {
    power: parseStatField(formData.get("statPower")),
    speed: parseStatField(formData.get("statSpeed")),
    intelligence: parseStatField(formData.get("statIntelligence")),
    magic: parseStatField(formData.get("statMagic")),
  };

  if (!title) {
    return NextResponse.json(
      { error: "Укажите название карточки." },
      { status: 400 }
    );
  }

  let frontImagePath = existing.frontImage;
  const imagePipe: CardImageSavePipeline =
    category === "TMNT" ? "tmntPoster" : "card34";

  const frontResolved = await resolveUploadedImage(
    formData,
    "frontImageUrl",
    "frontImage",
    imagePipe,
  );
  if (frontResolved) {
    frontImagePath = frontResolved;
  }
  if (!frontImagePath?.trim()) {
    return NextResponse.json(
      { error: "Нужна лицевая сторона карточки." },
      { status: 400 }
    );
  }

  const backResolved = await resolveUploadedImage(
    formData,
    "backImageUrl",
    "backImage",
    imagePipe,
  );

  const middleResolved = await resolveUploadedImage(
    formData,
    "middleImageUrl",
    "middleImage",
    imagePipe,
  );

  let backImagePath = "";
  if (effect === "vario" || effect === "morphing") {
    backImagePath = backResolved ?? existing.backImage;
    if (!backImagePath?.trim()) {
      return NextResponse.json(
        {
          error:
            effect === "morphing"
              ? "Для Morphing нужно второе изображение — загрузите файл или оставьте существующее."
              : "Для Vario нужен оборот — загрузите второе изображение или оставьте существующее.",
        },
        { status: 400 }
      );
    }
  }

  const categoryBgUrlPatch = String(formData.get("categoryBgUrl") ?? "").trim();
  const categoryBgUpload = formData.get("categoryBgFile");

  const updated: StoredCard = {
    ...existing,
    title,
    description,
    category,
    subcategory: "",
    frontImage: frontImagePath,
    backImage: backImagePath,
    price,
    rarity: canonicalRarityFromTags(rarityTagsPatch),
    stats,
    effect,
  };
  if (rarityTagsPatch.length > 1) {
    updated.rarities = rarityTagsPatch;
  } else {
    delete updated.rarities;
  }

  if (effect === "vario") {
    if (middleResolved) {
      updated.middleImage = middleResolved;
    } else if (formData.has("middleImageUrl")) {
      const midUrl = String(formData.get("middleImageUrl") ?? "").trim();
      if (midUrl && isSafeUploadPublicPath(midUrl)) {
        updated.middleImage = midUrl;
      } else if (midUrl === "") {
        delete updated.middleImage;
        delete updated.middleImageFocus;
      }
    }
  } else {
    delete updated.middleImage;
    delete updated.middleImageFocus;
  }

  if (categoryBgUrlPatch && isSafeUploadPublicPath(categoryBgUrlPatch)) {
    updated.categoryBg = categoryBgUrlPatch;
  } else if (categoryBgUpload instanceof File && categoryBgUpload.size > 0) {
    updated.categoryBg = await saveImageFile(
      categoryBgUpload,
      category === "TMNT" ? "tmntPoster" : "card34",
    );
  }

  updated.inStock = formData.has("inStock")
    ? parseCardFlag(formData.get("inStock"))
    : existing.inStock;
  updated.ratingAvg = parseRatingAvg(
    formData.get("ratingAvg") ?? existing.ratingAvg
  );
  updated.reviewCount = parseReviewCount(
    formData.get("reviewCount") ?? existing.reviewCount
  );

  const reviewsJsonPatch = String(formData.get("reviewsJson") ?? "").trim();
  if (formData.has("reviewsJson")) {
    if (reviewsJsonPatch) {
      try {
        const parsed = JSON.parse(reviewsJsonPatch) as unknown;
        const r = parseReviews(parsed);
        if (r) {
          updated.reviews = r;
          if (parseReviewCount(formData.get("reviewCount")) <= 0) {
            updated.reviewCount = r.length;
          }
        } else {
          delete updated.reviews;
        }
      } catch {
        /* keep existing reviews on parse error */
      }
    } else {
      delete updated.reviews;
    }
  }

  const productVideoPatch = String(formData.get("productVideo") ?? "").trim();
  if (productVideoPatch && isSafeVideoUrl(productVideoPatch)) {
    updated.productVideo = productVideoPatch;
  } else if (formData.has("productVideo") && !productVideoPatch) {
    delete updated.productVideo;
    delete updated.productVideoFocus;
  }

  if (formData.has("frontHoverGifUrl")) {
    const g = String(formData.get("frontHoverGifUrl") ?? "").trim();
    if (g && isSafeFrontHoverMotionPath(g)) {
      updated.frontHoverGif = g;
    } else {
      delete updated.frontHoverGif;
    }
  }

  const btPatch = parseIdListFromComma(
    String(formData.get("boughtTogetherIds") ?? "")
  );
  if (btPatch.length) {
    updated.boughtTogetherIds = btPatch;
  } else if (formData.has("boughtTogetherIds")) {
    delete updated.boughtTogetherIds;
  }

  const recPatch = parseIdListFromComma(
    String(formData.get("recommendedIds") ?? "")
  );
  if (recPatch.length) {
    updated.recommendedIds = recPatch;
  } else if (formData.has("recommendedIds")) {
    delete updated.recommendedIds;
  }

  if (formData.has("frontImageFocus")) {
    const f = parseImageFocusJson(
      String(formData.get("frontImageFocus") ?? "")
    );
    if (f) {
      updated.frontImageFocus = f;
    } else {
      delete updated.frontImageFocus;
    }
  }
  if (effect === "vario" || effect === "morphing") {
    if (formData.has("backImageFocus")) {
      const f = parseImageFocusJson(
        String(formData.get("backImageFocus") ?? "")
      );
      if (f) {
        updated.backImageFocus = f;
      } else {
        delete updated.backImageFocus;
      }
    }
    if (effect === "vario" && formData.has("middleImageFocus")) {
      if (updated.middleImage?.trim()) {
        const f = parseImageFocusJson(
          String(formData.get("middleImageFocus") ?? "")
        );
        if (f) {
          updated.middleImageFocus = f;
        } else {
          delete updated.middleImageFocus;
        }
      } else {
        delete updated.middleImageFocus;
      }
    }
  } else {
    delete updated.backImageFocus;
  }
  if (formData.has("categoryBgFocus")) {
    const f = parseImageFocusJson(
      String(formData.get("categoryBgFocus") ?? "")
    );
    if (f) {
      if (updated.categoryBg?.trim()) {
        updated.categoryBgFocus = f;
      } else {
        delete updated.categoryBgFocus;
      }
    } else {
      delete updated.categoryBgFocus;
    }
  }

  if (formData.has("productVideoFocus")) {
    const f = parseImageFocusJson(
      String(formData.get("productVideoFocus") ?? "")
    );
    if (f && updated.productVideo?.trim()) {
      updated.productVideoFocus = f;
    } else {
      delete updated.productVideoFocus;
    }
  }

  if (formData.has("categoryOrder")) {
    const str = String(formData.get("categoryOrder") ?? "").trim();
    if (str === "") {
      delete updated.categoryOrder;
    } else {
      const co = parseCategoryOrder(formData.get("categoryOrder"));
      if (co !== undefined) {
        updated.categoryOrder = co;
      }
    }
  }

  if (effect === "vario") {
    if (parseCardFlag(formData.get("varioSmoothBlend"))) {
      updated.varioSmoothBlend = true;
    } else {
      delete updated.varioSmoothBlend;
    }
  } else {
    delete updated.varioSmoothBlend;
  }
  if (effect === "vario" || effect === "morphing") {
    const vsPatch = parseVarioSmoothing(formData.get("varioSmoothing"));
    updated.varioSmoothing =
      vsPatch ?? existing.varioSmoothing ?? 0.18;
  } else {
    delete updated.varioSmoothing;
  }

  if (formData.has("priceRub")) {
    const str = String(formData.get("priceRub") ?? "").trim();
    if (str === "") {
      delete updated.priceRub;
    } else {
      const pr = parseOptionalPriceRub(formData.get("priceRub"));
      if (pr !== undefined) {
        updated.priceRub = pr;
      }
    }
  }

  const fdPatch = await readPublicImageDimensions(frontImagePath.trim());
  if (category === "TMNT") {
    updated.frontImageWidth = TMNT_REFERENCE_POSTER_DIMENSIONS.width;
    updated.frontImageHeight = TMNT_REFERENCE_POSTER_DIMENSIONS.height;
  } else if (fdPatch) {
    updated.frontImageWidth = fdPatch.width;
    updated.frontImageHeight = fdPatch.height;
  }

  const framePatch = parseCardArtFramePreset(formData.get("cardArtFramePreset"));
  if (isFixedCardArtFramePreset(framePatch)) {
    updated.cardArtFramePreset = framePatch;
  } else {
    delete updated.cardArtFramePreset;
  }

  cards[idx] = updated;
  await fs.writeFile(DATA_PATH, JSON.stringify(cards, null, 2), "utf-8");

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  await ensureStorage();
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Укажите id карточки." }, { status: 400 });
  }

  const cards = await readCards();
  const next = cards.filter((c) => c.id !== id);
  if (next.length === cards.length) {
    return NextResponse.json({ error: "Карточка не найдена." }, { status: 404 });
  }

  await fs.writeFile(DATA_PATH, JSON.stringify(next, null, 2), "utf-8");
  return NextResponse.json({ ok: true });
}
