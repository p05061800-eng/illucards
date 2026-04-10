import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import type { ImageFocus } from "@/app/lib/imageFocus";
import { parseImageFocus, parseImageFocusJson } from "@/app/lib/imageFocus";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import {
  imageBufferTo34Webp,
  isSafeUploadPublicPath,
} from "@/app/lib/serverImage";

const DATA_PATH = path.join(process.cwd(), "data", "cards.json");
const UPLOAD_PUBLIC = path.join(process.cwd(), "public", "uploads");

async function ensureStorage() {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.mkdir(UPLOAD_PUBLIC, { recursive: true });
}

/** Витрины: обычная / лимитированная / 18+ / новинки / горячая цена */
export type CardRarity =
  | "common"
  | "limited"
  | "adult"
  | "novelty"
  | "hot_price";

const RARITIES: CardRarity[] = [
  "common",
  "limited",
  "adult",
  "novelty",
  "hot_price",
];

const LEGACY_RARITY: Record<string, CardRarity> = {
  rare: "novelty",
  epic: "hot_price",
  legendary: "limited",
};

/** Только Vario (две картинки) или 3D (лицевая + наклон без варио). */
export type CardEffectKind = "vario" | "3d-horizontal";

export function normalizeCardEffect(raw: unknown): CardEffectKind {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "vario") return "vario";
  return "3d-horizontal";
}

function parseRarity(raw: unknown): CardRarity {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (RARITIES.includes(s as CardRarity)) return s as CardRarity;
  return LEGACY_RARITY[s] ?? "limited";
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

export type CardStats = {
  power: number;
  speed: number;
  intelligence: number;
  magic: number;
};

const DEFAULT_STATS: CardStats = {
  power: 50,
  speed: 50,
  intelligence: 50,
  magic: 50,
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

export type CardReview = {
  author: string;
  rating: number;
  text: string;
  date?: string;
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
  /** Tailwind-классы градиента для hero (например from-red-900 via-black to-orange-900). */
  bg?: string;
  /** Фон категории в hero (слой под картами). */
  categoryBg?: string;
  /** Полноэкранный размытый фон hero для карточки. */
  heroBg?: string;
  /** Самый дальний слой фона hero (за heroBg). */
  ultraBg?: string;
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
  /** Базовая валюта — BYN (отображение RUB на клиенте). */
  price: number;
  rarity: CardRarity;
  stats: CardStats;
  effect?: string;
  /** Фокус кадра при cover: лицо (0–100 %). */
  frontImageFocus?: ImageFocus;
  /** Фокус кадра при cover: оборот (Vario). */
  backImageFocus?: ImageFocus;
  /** Фокус для фона категории (слой в витрине). */
  categoryBgFocus?: ImageFocus;
};

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
  return 4.8;
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
    out.push({ author, rating, text, ...(date ? { date } : {}) });
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

function parseIdListFromComma(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
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
  if (effect === "vario") {
    back = rawBackFull || front;
  }

  const reviewsParsed = parseReviews(raw.reviews);
  const reviewCountRaw = parseReviewCount(raw.reviewCount);
  const countFromReviews = reviewsParsed?.length ?? 0;
  const card: StoredCard = {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    category:
      typeof raw.category === "string" ? raw.category : "",
    subcategory: "",
    frontImage: front,
    backImage: back,
    price: parsePrice(raw.price),
    rarity: parseRarity(raw.rarity),
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
  if (reviewsParsed) {
    card.reviews = reviewsParsed;
  }
  const pv =
    typeof raw.productVideo === "string" ? raw.productVideo.trim() : "";
  if (pv && isSafeVideoUrl(pv)) {
    card.productVideo = pv;
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
    card.categoryBg = categoryBgRaw;
  } else if (legacyBgImage) {
    card.categoryBg = legacyBgImage;
  }
  const heroBgRaw = typeof raw.heroBg === "string" ? raw.heroBg.trim() : "";
  if (heroBgRaw) {
    card.heroBg = heroBgRaw;
  }
  const ultraBgRaw = typeof raw.ultraBg === "string" ? raw.ultraBg.trim() : "";
  if (ultraBgRaw) {
    card.ultraBg = ultraBgRaw;
  }
  const ff = parseImageFocus(raw.frontImageFocus);
  if (ff) {
    card.frontImageFocus = ff;
  }
  const bf = parseImageFocus(raw.backImageFocus);
  if (bf) {
    card.backImageFocus = bf;
  }
  const cf = parseImageFocus(raw.categoryBgFocus);
  if (cf) {
    card.categoryBgFocus = cf;
  }
  const vf = parseImageFocus(raw.productVideoFocus);
  if (vf && card.productVideo?.trim()) {
    card.productVideoFocus = vf;
  }
  return card;
}

async function saveImageFile(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const processed = await imageBufferTo34Webp(buffer);
  const filename = `${randomUUID()}.webp`;
  await fs.writeFile(path.join(UPLOAD_PUBLIC, filename), processed);
  return `/uploads/${filename}`;
}

async function resolveUploadedImage(
  formData: FormData,
  urlKey: string,
  fileKey: string
): Promise<string | null> {
  const urlRaw = String(formData.get(urlKey) ?? "").trim();
  if (urlRaw && isSafeUploadPublicPath(urlRaw)) {
    return urlRaw;
  }
  const file = formData.get(fileKey);
  if (file instanceof File && file.size > 0) {
    return saveImageFile(file);
  }
  return null;
}

/** Разбор JSON из файла — учитывает старые карточки с полем `image`. */
export function parseCardsJson(json: string): StoredCard[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) =>
      normalizeCard(item as Record<string, unknown>)
    );
  } catch {
    return [];
  }
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
  const rarity = parseRarity(formData.get("rarity"));
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

  const frontImagePath = await resolveUploadedImage(
    formData,
    "frontImageUrl",
    "frontImage"
  );
  if (!frontImagePath) {
    return NextResponse.json(
      { error: "Выберите изображение лицевой стороны (загрузите файл)." },
      { status: 400 }
    );
  }

  let backImagePath = "";
  if (effect === "vario") {
    const resolved = await resolveUploadedImage(
      formData,
      "backImageUrl",
      "backImage"
    );
    if (!resolved) {
      return NextResponse.json(
        {
          error:
            "Для эффекта Vario нужна оборотная сторона — загрузите второе изображение.",
        },
        { status: 400 }
      );
    }
    backImagePath = resolved;
  }

  const categoryBgUrlRaw = String(formData.get("categoryBgUrl") ?? "").trim();
  const categoryBgUpload = formData.get("categoryBgFile");
  let categoryBgPath: string | undefined;
  if (categoryBgUrlRaw && isSafeUploadPublicPath(categoryBgUrlRaw)) {
    categoryBgPath = categoryBgUrlRaw;
  } else if (categoryBgUpload instanceof File && categoryBgUpload.size > 0) {
    categoryBgPath = await saveImageFile(categoryBgUpload);
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
    rarity,
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
  if (effect === "vario") {
    const backFocusPost = parseImageFocusJson(
      String(formData.get("backImageFocus") ?? "")
    );
    if (backFocusPost) {
      newCard.backImageFocus = backFocusPost;
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
  const rarity = parseRarity(formData.get("rarity"));
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
  const frontResolved = await resolveUploadedImage(
    formData,
    "frontImageUrl",
    "frontImage"
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
    "backImage"
  );

  let backImagePath = "";
  if (effect === "vario") {
    backImagePath = backResolved ?? existing.backImage;
    if (!backImagePath?.trim()) {
      return NextResponse.json(
        {
          error:
            "Для Vario нужен оборот — загрузите второе изображение или оставьте существующее.",
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
    rarity,
    stats,
    effect,
  };

  if (categoryBgUrlPatch && isSafeUploadPublicPath(categoryBgUrlPatch)) {
    updated.categoryBg = categoryBgUrlPatch;
  } else if (categoryBgUpload instanceof File && categoryBgUpload.size > 0) {
    updated.categoryBg = await saveImageFile(categoryBgUpload);
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
  if (effect === "vario") {
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
