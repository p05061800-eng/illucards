import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/app/lib/adminSession";
import { promises as fs } from "fs";
import path from "path";
import {
  normalizePromoSlides,
  parsePromoSlides,
  type PromoSlidesFile,
} from "@/app/lib/promoSlidesJson";
import {
  DURABLE_JSON_KEYS,
  loadDurableJsonText,
  saveDurableJsonText,
} from "@/app/lib/durableJson";

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
  const data =
    (await loadDurableJsonText(DURABLE_JSON_KEYS.promo, filePath)) ??
    JSON.stringify(defaultJson);
  const items = parsePromoSlides(JSON.parse(data));
  return NextResponse.json({ items } satisfies PromoSlidesFile);
}

export async function POST(req: NextRequest) {
  const denied = rejectUnlessAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const parsed = parsePromoSlides(
    body && typeof body === "object" && "items" in body ? body : { items: [] }
  );
  const normalized = normalizePromoSlides(parsed);
  try {
    await saveDurableJsonText(
      DURABLE_JSON_KEYS.promo,
      filePath,
      JSON.stringify(normalized, null, 2),
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Не удалось сохранить." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, items: normalized.items });
}
