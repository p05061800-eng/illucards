import path from "path";
import sharp from "sharp";
import { isSafeUploadPublicPath } from "@/app/lib/serverImage";

/** Размеры файла в `public/` по URL вида `/uploads/...`. */
export async function readPublicImageDimensions(
  publicUrl: string,
): Promise<{ width: number; height: number } | null> {
  const t = publicUrl?.trim();
  if (!t || !isSafeUploadPublicPath(t)) return null;
  const fp = path.join(process.cwd(), "public", t.replace(/^\//, ""));
  try {
    const m = await sharp(fp).metadata();
    if (
      typeof m.width === "number" &&
      typeof m.height === "number" &&
      m.width > 0 &&
      m.height > 0
    ) {
      return { width: m.width, height: m.height };
    }
  } catch {
    return null;
  }
  return null;
}
