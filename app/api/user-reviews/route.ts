import { NextResponse } from "next/server";
import {
  appendUserReview,
  isAllowedReviewImageUrl,
  readUserReviews,
} from "@/app/lib/userReviews";

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
  };

  const cardId = typeof o.cardId === "string" ? o.cardId.trim() : "";
  const authorRaw = typeof o.author === "string" ? o.author : "";
  const text = typeof o.text === "string" ? o.text.trim() : "";
  const rating = Number(o.rating);

  if (!cardId) {
    return NextResponse.json({ error: "Укажите товар." }, { status: 400 });
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
    if (images.length > 5) {
      return NextResponse.json(
        { error: "Не более 5 фотографий." },
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
  });

  return NextResponse.json({ ok: true, review: entry });
}
