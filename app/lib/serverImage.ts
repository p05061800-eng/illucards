import sharp from "sharp";

/** Выход 3:4 для обложек и карточек (как 600×800). */
export const UPLOAD_IMAGE_WIDTH = 600;
export const UPLOAD_IMAGE_HEIGHT = 800;

export async function imageBufferTo34Webp(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(UPLOAD_IMAGE_WIDTH, UPLOAD_IMAGE_HEIGHT, {
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
