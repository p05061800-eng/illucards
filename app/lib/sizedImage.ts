import { publicCdnUploadUrl } from "@/app/lib/publicCdnUploadUrl";

function isSafeUploadPath(pathname: string): boolean {
  const s = pathname.trim();
  if (!s || s.includes("..") || s.includes("\\")) return false;
  return (
    /^\/uploads\/[a-zA-Z0-9._/-]+$/.test(s) ||
    /^\/api\/media\/[a-zA-Z0-9._/-]+$/.test(s)
  );
}

function isSafeBlobUrl(src: string): boolean {
  try {
    const url = new URL(src.trim());
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".public.blob.vercel-storage.com") &&
      !url.username &&
      !url.password &&
      !url.pathname.includes("..")
    );
  } catch {
    return false;
  }
}

/** Разрешённые ширины ресайза (длинная сторона не увеличивается). */
export const IMAGE_WIDTHS = [160, 240, 320, 400, 480, 640, 800, 1280] as const;
export type ImageWidth = (typeof IMAGE_WIDTHS)[number];

export const IMAGE_W = {
  thumb: 160,
  compact: 240,
  tile: 400,
  plate: 480,
  card: 640,
  banner: 1280,
} as const satisfies Record<string, ImageWidth>;

export function snapImageWidth(width: number): ImageWidth {
  const n = Number.isFinite(width) ? Math.round(width) : IMAGE_W.tile;
  for (const step of IMAGE_WIDTHS) {
    if (n <= step) return step;
  }
  return IMAGE_W.banner;
}

function normalizeImageSrc(src: string): string {
  const t = src.trim();
  if (!t) return "";
  if (t.startsWith("/")) {
    const pathOnly = t.split("?")[0] ?? t;
    return publicCdnUploadUrl(pathOnly);
  }
  try {
    const u = new URL(t);
    if (
      u.hostname === "www.illucards.by" ||
      u.hostname === "illucards.by" ||
      u.hostname === "localhost"
    ) {
      return publicCdnUploadUrl(u.pathname);
    }
    return t;
  } catch {
    return t;
  }
}

export function canSizeImageSrc(src: string): boolean {
  const n = normalizeImageSrc(src);
  if (!n || n.startsWith("/api/img")) return false;
  return isSafeUploadPath(n) || isSafeBlobUrl(n);
}

/** URL уменьшенной копии для списков/превью. Полный файл остаётся для страницы карточки. */
export function sizedImageSrc(
  src: string | undefined | null,
  width: number,
): string {
  const raw = (src ?? "").trim();
  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
  if (raw.startsWith("/backgrounds/") || raw.startsWith("/categories/")) {
    return raw;
  }
  const n = normalizeImageSrc(raw);
  if (!canSizeImageSrc(n)) return raw;
  const w = snapImageWidth(width * 2);
  return n;
}
