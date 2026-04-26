import { NextResponse } from "next/server";
import {
  hasPurchasedCard,
  recordPurchasedCards,
} from "@/app/lib/purchasedCardIds";

export async function GET(req: Request) {
  const cardId = new URL(req.url).searchParams.get("cardId")?.trim() ?? "";
  if (!cardId) {
    return NextResponse.json({ purchased: false });
  }
  const purchased = await hasPurchasedCard(cardId);
  return NextResponse.json({ purchased });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }
  const o = body as { cardIds?: unknown };
  if (!Array.isArray(o.cardIds)) {
    return NextResponse.json(
      { error: "Ожидается поле cardIds: string[]" },
      { status: 400 }
    );
  }
  const ids = o.cardIds
    .map((x) => String(x).trim())
    .filter((s) => s.length > 0);
  if (ids.length === 0) {
    return NextResponse.json({ error: "Пустой список cardIds" }, { status: 400 });
  }
  await recordPurchasedCards(ids);
  return NextResponse.json({ ok: true });
}
