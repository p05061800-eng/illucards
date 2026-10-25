import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/app/lib/adminSession";
import { savePublicUpload } from "@/app/lib/durableJson";
import {
  imageBufferLogoWebp,
  imageBufferPromoBannerWebp,
  imageBufferTo34Webp,
  imageBufferToBerserkPosterWebp,
  imageBufferToTransformersPrimePosterWebp,
  imageBufferToTmntPosterWebp,
} from "@/app/lib/serverImage";

function isUploadBlob(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === "function" &&
    typeof (value as Blob).size === "number"
  );
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const file = data.get("file");

    if (!isUploadBlob(file) || file.size < 1) {
      return NextResponse.json({ error: "no file" }, { status: 400 });
    }

    const mime = "type" in file && typeof file.type === "string" ? file.type : "";
    if (mime === "image/gif") {
      return NextResponse.json(
        {
          error:
            "GIF не поддерживаются. Загрузите PNG/JPEG/WebP или короткое видео (MP4) для анимации при наведении.",
        },
        { status: 400 },
      );
    }

    const purposeRaw = data.get("purpose");
    const purpose =
      typeof purposeRaw === "string" ? purposeRaw.trim().toLowerCase() : "";
    const useLogoPipeline = purpose === "logo" || purpose === "category";
    const usePromoPipeline = purpose === "promo";

    if (useLogoPipeline || usePromoPipeline) {
      const denied = rejectUnlessAdmin(req);
      if (denied) return denied;
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const cardCategoryRaw = data.get("cardCategory");
    const cardCategory =
      typeof cardCategoryRaw === "string" ? cardCategoryRaw.trim() : "";

    let processed: Buffer;
    try {
      processed = usePromoPipeline
        ? await imageBufferPromoBannerWebp(buffer)
        : useLogoPipeline
          ? await imageBufferLogoWebp(buffer)
          : cardCategory === "TMNT"
            ? await imageBufferToTmntPosterWebp(buffer)
            : cardCategory === "Берсерк"
              ? await imageBufferToBerserkPosterWebp(buffer)
              : cardCategory.trim().toLowerCase().includes("трансформер")
                ? await imageBufferToTransformersPrimePosterWebp(buffer)
                : await imageBufferTo34Webp(buffer);
    } catch {
      if (usePromoPipeline) {
        try {
          processed = await imageBufferLogoWebp(buffer);
        } catch {
          return NextResponse.json(
            {
              error:
                "Не удалось обработать изображение. Сохраните файл как JPG, PNG или WebP и попробуйте снова.",
            },
            { status: 400 },
          );
        }
      } else {
        return NextResponse.json(
          { error: "Не удалось обработать изображение." },
          { status: 400 },
        );
      }
    }

    const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}.webp`;
    const url = await savePublicUpload(fileName, processed, "image/webp");
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Image upload failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось сохранить изображение. Проверьте настройки хранилища.",
      },
      { status: 500 },
    );
  }
}
