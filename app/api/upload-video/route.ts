import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { tryTranscodeToTmntPosterMp4 } from "@/app/lib/tmntHoverVideo";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "videos");

const MIME_TO_EXT = new Map<string, string>([
  ["video/mp4", ".mp4"],
  ["video/webm", ".webm"],
  ["video/quicktime", ".mov"],
  /** Часто у .mov/.mp4 с телефонов */
  ["video/x-quicktime", ".mov"],
  ["video/3gpp", ".mp4"],
  ["video/3gpp2", ".mp4"],
]);

const MAX_BYTES = 120 * 1024 * 1024;

function normalizeMime(type: string): string {
  return type.split(";")[0]?.trim().toLowerCase() ?? "";
}

/** Когда MIME пустой или application/octet-stream — только по имени файла */
function extFromFilename(name: string): string | null {
  const lower = name.trim().toLowerCase();
  if (lower.endsWith(".mp4") || lower.endsWith(".m4v")) return ".mp4";
  if (lower.endsWith(".webm")) return ".webm";
  if (lower.endsWith(".mov")) return ".mov";
  return null;
}

function resolveVideoExt(file: File): string | null {
  const fromMime = MIME_TO_EXT.get(normalizeMime(file.type));
  if (fromMime) return fromMime;
  return extFromFilename(file.name);
}

export async function POST(req: Request) {
  const data = await req.formData();
  const file = data.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Файл слишком большой (макс. 120 МБ)." },
      { status: 400 }
    );
  }

  const ext = resolveVideoExt(file);
  if (!ext) {
    return NextResponse.json(
      {
        error:
          "Не удалось определить формат. Используйте MP4, WebM или MOV (проверьте расширение в имени файла).",
      },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const cardCategoryRaw = data.get("cardCategory");
  const cardCategory =
    typeof cardCategoryRaw === "string" ? cardCategoryRaw.trim() : "";

  let outBuffer: Buffer = buffer;
  let outExt = ext;
  let transcoded = false;
  if (
    cardCategory === "TMNT" &&
    (ext === ".mp4" || ext === ".m4v" || ext === ".mov")
  ) {
    const next = await tryTranscodeToTmntPosterMp4(buffer, ext);
    if (next) {
      outBuffer = next;
      outExt = ".mp4";
      transcoded = true;
    }
  }

  const name = `${randomUUID()}${outExt}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), outBuffer);

  const url = `/uploads/videos/${name}`;
  return NextResponse.json({
    url,
    ...(cardCategory === "TMNT" ? { transcoded } : {}),
  });
}
