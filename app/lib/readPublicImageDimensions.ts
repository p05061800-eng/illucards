import path from "path";
import sharp from "sharp";
import { loadDurableUpload } from "@/app/lib/durableJson";
import { isSafeUploadPublicPath } from "@/app/lib/serverImage";

/** Размеры файла в `public/` или Redis по URL `/uploads/...` и `/api/media/...`. */
export async function readPublicImageDimensions(
  publicUrl: string,
): Promise<{ width: number; height: number } | null> {
  const t = publicUrl?.trim();
  if (!t || !isSafeUploadPublicPath(t)) return null;
  let input: string | Buffer = path.join(
    process.cwd(),
    "public",
    t.replace(/^\//, ""),
  );
  if (t.startsWith("/api/media/")) {
    const bytes = await loadDurableUpload(t.slice("/api/media/".length));
    if (!bytes) return null;
    input = bytes;
  }
  try {
    const m = await sharp(input).metadata();
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
