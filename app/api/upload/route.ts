import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { rejectUnlessAdmin } from "@/app/lib/adminSession";
import {
  imageBufferLogoWebp,
  imageBufferPromoBannerWebp,
  imageBufferTo34Webp,
  imageBufferToTmntPosterWebp,
} from "@/app/lib/serverImage";

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const file = data.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "no file" },
        { status: 400 }
      );
    }

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
      typeof purposeRaw === "string"
        ? purposeRaw.trim().toLowerCase()
        : "";

    const useLogoPipeline =
      purpose === "logo" || purpose === "category";
    const usePromoPipeline = purpose === "promo";

    if (useLogoPipeline || usePromoPipeline) {
      const denied = rejectUnlessAdmin(req);
      if (denied) return denied;
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const cardCategoryRaw = data.get("cardCategory");
    const cardCategory =
      typeof cardCategoryRaw === "string"
        ? cardCategoryRaw.trim()
        : "";

    let processed: Buffer;

    try {
      processed = usePromoPipeline
        ? await imageBufferPromoBannerWebp(buffer)
        : useLogoPipeline
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

    const fileName =
      `${Date.now()}-${randomUUID().slice(0, 8)}.webp`;

    const blob = await put(fileName, processed, {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/webp",
      cacheControlMaxAge: 31536000,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error("Image upload failed:", error);

    return NextResponse.json(
      {
        error:
          "Не удалось сохранить изображение. Проверьте настройки хранилища.",
      },
      { status: 500 }
    );
  }
}
