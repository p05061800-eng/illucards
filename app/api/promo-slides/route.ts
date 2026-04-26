import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  normalizePromoSlides,
  parsePromoSlides,
  type PromoSlidesFile,
} from "@/app/lib/promoSlidesJson";

const filePath = path.join(process.cwd(), "data", "promo-slides.json");

const defaultJson: PromoSlidesFile = { items: [] };

async function ensureFile() {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(
      filePath,
      JSON.stringify(defaultJson, null, 2),
      "utf-8"
    );
  }
}

export async function GET() {
  await ensureFile();
  const data = await fs.readFile(filePath, "utf-8");
  const items = parsePromoSlides(JSON.parse(data));
  return NextResponse.json({ items } satisfies PromoSlidesFile);
}

export async function POST(req: Request) {
  await ensureFile();
  const body = await req.json();
  const parsed = parsePromoSlides(
    body && typeof body === "object" && "items" in body ? body : { items: [] }
  );
  const normalized = normalizePromoSlides(parsed);
  await fs.writeFile(
    filePath,
    JSON.stringify(normalized, null, 2),
    "utf-8"
  );
  return NextResponse.json({ ok: true, items: normalized.items });
}
