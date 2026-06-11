import { NextResponse } from "next/server";
import { hasPurchasedCard } from "@/app/lib/purchasedCardIds";
import {
  appendUserReview,
  isAllowedReviewImageUrl,
  isAllowedReviewVideoUrl,
  readUserReviews,
} from "@/app/lib/userReviews";

const MAX_REVIEW_IMAGES = 8;
const MAX_REVIEW_VIDEOS = 5;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cardId = searchParams.get("cardId")?.trim() ?? "";
  let list = await readUserReviews();
  if (cardId) {
    list = list.filter((r) => r.cardId === cardId);
  }
  list = [...list].sort((a, b) => b.date.localeCompare(a.date));
  return NextResponse.json({ reviews: list });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }
  const o = body as {
    cardId?: unknown;
    author?: unknown;
    rating?: unknown;
    text?: unknown;
    images?: unknown;
    videos?: unknown;
  };

  const cardId = typeof o.cardId === "string" ? o.cardId.trim() : "";
  const authorRaw = typeof o.author === "string" ? o.author : "";
  const text = typeof o.text === "string" ? o.text.trim() : "";
  const rating = Number(o.rating);

  if (!cardId) {
    return NextResponse.json({ error: "Укажите товар." }, { status: 400 });
  }

  if (!(await hasPurchasedCard(cardId))) {
    return NextResponse.json(
      {
        error:
          "Отзыв можно оставить только после покупки этой карточки на сайте.",
      },
      { status: 403 }
    );
  }
  if (text.length < 5 || text.length > 2000) {
    return NextResponse.json(
      { error: "Текст отзыва: от 5 до 2000 символов." },
      { status: 400 }
    );
  }
  if (
    !Number.isFinite(rating) ||
    rating < 1 ||
    rating > 5 ||
    Math.floor(rating) !== rating
  ) {
    return NextResponse.json(
      { error: "Оценка должна быть целым числом от 1 до 5." },
      { status: 400 }
    );
  }

  const author =
    authorRaw.trim().slice(0, 80) || "Покупатель";

  let images: string[] = [];
  if (o.images != null) {
    if (!Array.isArray(o.images)) {
      return NextResponse.json({ error: "Неверный формат фото." }, { status: 400 });
    }
    images = o.images
      .map((x) => String(x).trim())
      .filter((s) => s.length > 0 && isAllowedReviewImageUrl(s));
    if (images.length > MAX_REVIEW_IMAGES) {
      return NextResponse.json(
        { error: `Не более ${MAX_REVIEW_IMAGES} фотографий.` },
        { status: 400 }
      );
    }
  }

  let videos: string[] = [];
  if (o.videos != null) {
    if (!Array.isArray(o.videos)) {
      return NextResponse.json({ error: "Неверный формат видео." }, { status: 400 });
    }
    videos = o.videos
      .map((x) => String(x).trim())
      .filter((s) => s.length > 0 && isAllowedReviewVideoUrl(s));
    if (videos.length > MAX_REVIEW_VIDEOS) {
      return NextResponse.json(
        { error: `Не более ${MAX_REVIEW_VIDEOS} видео.` },
        { status: 400 }
      );
    }
  }

  const entry = await appendUserReview({
    cardId,
    author,
    rating,
    text,
    images,
    videos,
  });

  return NextResponse.json({ ok: true, review: entry });
}
