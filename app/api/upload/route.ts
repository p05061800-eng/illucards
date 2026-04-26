import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  imageBufferLogoWebp,
  imageBufferTo34Webp,
  imageBufferToTmntPosterWebp,
} from "@/app/lib/serverImage";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

export async function POST(req: Request) {
  const data = await req.formData();
  const file = data.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  if (file.type === "image/gif") {
    return NextResponse.json(
      {
        error:
          "GIF не поддерживаются. Загрузите PNG/JPEG/WebP или короткое видео (MP4) для анимации при наведении.",
      },
      { status: 400 }
    );
  }

  const purposeRaw = data.get("purpose");
  const purpose =
    typeof purposeRaw === "string" ? purposeRaw.trim().toLowerCase() : "";
  const useLogoPipeline = purpose === "logo" || purpose === "category";

  const cardCategoryRaw = data.get("cardCategory");
  const cardCategory =
    typeof cardCategoryRaw === "string" ? cardCategoryRaw.trim() : "";

  let processed: Buffer;
  try {
    processed = useLogoPipeline
      ? await imageBufferLogoWebp(buffer)
      : cardCategory === "TMNT"
        ? await imageBufferToTmntPosterWebp(buffer)
        : await imageBufferTo34Webp(buffer);
  } catch {
    return NextResponse.json(
      { error: "Не удалось обработать изображение." },
      { status: 400 }
    );
  }

  const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}.webp`;
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_ROOT, fileName), processed);

  return NextResponse.json({
    url: `/uploads/${fileName}`,
  });
}
