import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { isSafeUploadPublicPath } from "@/app/lib/serverImage";

const FILE = path.join(process.cwd(), "data", "user-reviews.json");

export type UserReviewEntry = {
  id: string;
  cardId: string;
  author: string;
  rating: number;
  text: string;
  /** ISO */
  date: string;
  images: string[];
  /** Устаревшее: один ролик; при чтении объединяется с `videos`. */
  video?: string | null;
  videos?: string[];
};

function isValidEntry(x: unknown): x is UserReviewEntry {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    o.id.length === 0 ||
    typeof o.cardId !== "string" ||
    o.cardId.length === 0 ||
    typeof o.author !== "string" ||
    typeof o.rating !== "number" ||
    typeof o.text !== "string" ||
    typeof o.date !== "string" ||
    !Array.isArray(o.images) ||
    !o.images.every((im) => typeof im === "string")
  ) {
    return false;
  }
  if (o.video != null && typeof o.video !== "string") return false;
  if (o.videos != null) {
    if (!Array.isArray(o.videos) || !o.videos.every((v) => typeof v === "string")) {
      return false;
    }
  }
  return true;
}

export async function readUserReviews(): Promise<UserReviewEntry[]> {
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p.filter(isValidEntry);
  } catch {
    return [];
  }
}

export async function writeUserReviews(entries: UserReviewEntry[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(entries, null, 2), "utf-8");
}

export function isAllowedReviewImageUrl(s: string): boolean {
  return isSafeUploadPublicPath(s.trim());
}

/** Только загруженные в каталог отзывов ролики (`/uploads/videos/…`). */
export function isAllowedReviewVideoUrl(s: string): boolean {
  const t = s.trim();
  if (!t.startsWith("/uploads/videos/")) return false;
  if (t.includes("..") || t.includes("\\")) return false;
  return /^\/uploads\/videos\/[a-zA-Z0-9._-]+$/.test(t);
}

export async function appendUserReview(data: {
  cardId: string;
  author: string;
  rating: number;
  text: string;
  images: string[];
  videos: string[];
}): Promise<UserReviewEntry> {
  const all = await readUserReviews();
  const entry: UserReviewEntry = {
    id: randomUUID(),
    cardId: data.cardId.trim(),
    author: data.author.trim() || "Покупатель",
    rating: data.rating,
    text: data.text.trim(),
    date: new Date().toISOString(),
    images: data.images,
    ...(data.videos.length > 0 ? { videos: data.videos } : {}),
  };
  all.push(entry);
  await writeUserReviews(all);
  return entry;
}
