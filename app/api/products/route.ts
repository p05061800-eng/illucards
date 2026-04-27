import { promises as fs } from "fs";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import path from "path";
import {
  parseCardsJson,
  type StoredCard,
} from "@/app/api/cards/route";

const DATA_PATH = path.join(process.cwd(), "data", "cards.json");

export type BotProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
};

async function readCards(): Promise<StoredCard[]> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    return parseCardsJson(raw);
  } catch {
    return [];
  }
}

function absoluteImage(origin: string, frontImage: string): string {
  const u = frontImage.trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  const pathPart = u.startsWith("/") ? u : `/${u}`;
  return `${origin.replace(/\/$/, "")}${pathPart}`;
}

function toProduct(card: StoredCard, origin: string): BotProduct {
  return {
    id: card.id,
    name: card.title.trim() || "—",
    category: card.category.trim(),
    price: Number.isFinite(card.price) ? card.price : 0,
    image: absoluteImage(origin, card.frontImage),
  };
}

/** Публичный список товаров для Telegram-бота и внешних клиентов (без полной карточки). */
export async function GET(request: NextRequest) {
  const cards = await readCards();
  const origin =
    request.headers.get("x-forwarded-host") &&
    request.headers.get("x-forwarded-proto")
      ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("x-forwarded-host")}`
      : request.nextUrl.origin;

  const products = cards.map((c) => toProduct(c, origin));
  return NextResponse.json(products, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
