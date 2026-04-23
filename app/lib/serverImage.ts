import sharp from "sharp";
import { TMNT_REFERENCE_POSTER_DIMENSIONS } from "./cardAspectRatio";

/** Выход для лиц карточек после аплоада — 600×900 (2:3). */
export const UPLOAD_IMAGE_WIDTH = 600;
export const UPLOAD_IMAGE_HEIGHT = 900;

export async function imageBufferTo34Webp(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(UPLOAD_IMAGE_WIDTH, UPLOAD_IMAGE_HEIGHT, {
      fit: "cover",
      position: "attention",
    })
    .webp({ quality: 86 })
    .toBuffer();
}

/** Фон категории для TMNT — как постер-референс (761×1024). */
export async function imageBufferToTmntPosterWebp(
  buffer: Buffer,
): Promise<Buffer> {
  const { width: w, height: h } = TMNT_REFERENCE_POSTER_DIMENSIONS;
  return sharp(buffer)
    .rotate()
    .resize(w, h, {
      fit: "cover",
      position: "attention",
    })
    .webp({ quality: 86 })
    .toBuffer();
}

const LOGO_MAX_SIDE = 1600;

/** Логотипы категорий / меню: без кадрирования, вписать в квадрат по длинной стороне (как «contain»). */
export async function imageBufferLogoWebp(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(LOGO_MAX_SIDE, LOGO_MAX_SIDE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 88 })
    .toBuffer();
}

/** Проверка пути в public (uploads и вложенные папки, без ..). */
export function isSafeUploadPublicPath(p: string): boolean {
  const s = p.trim();
  if (!s.startsWith("/uploads/")) return false;
  if (s.includes("..") || s.includes("\\")) return false;
  return /^\/uploads\/[a-zA-Z0-9._\/-]+$/.test(s);
}
