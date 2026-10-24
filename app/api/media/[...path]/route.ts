import { NextResponse } from "next/server";
import { loadDurableUpload } from "@/app/lib/durableJson";

/** Чтобы CDN мог кэшировать картинки. `force-dynamic` на проде даёт 3–10 с на каждый файл. */
export const revalidate = 86400;

function contentTypeFor(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".mp4") || n.endsWith(".m4v")) return "video/mp4";
  if (n.endsWith(".webm")) return "video/webm";
  if (n.endsWith(".mov")) return "video/quicktime";
  return "application/octet-stream";
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await ctx.params;
  const relative = (parts ?? []).join("/");
  const bytes = await loadDurableUpload(relative);
  if (!bytes || bytes.length < 1) {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentTypeFor(relative),
      "Cache-Control":
        "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}
