import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/app/lib/adminSession";
import path from "path";
import {
  normalizePromoHomeForSave,
  parsePromoHomeConfig,
  type PromoHomeConfig,
} from "@/app/lib/promoSlidesJson";
import {
  DURABLE_JSON_KEYS,
  loadDurableJsonText,
  saveDurableJsonText,
} from "@/app/lib/durableJson";

const filePath = path.join(process.cwd(), "data", "promo-slides.json");

const defaultJson: PromoHomeConfig = {
  customOrder: { imageUrl: "", href: "" },
  items: [],
};

async function loadConfig(): Promise<PromoHomeConfig> {
  const data =
    (await loadDurableJsonText(DURABLE_JSON_KEYS.promo, filePath)) ??
    JSON.stringify(defaultJson);
  try {
    return parsePromoHomeConfig(JSON.parse(data));
  } catch {
    return defaultJson;
  }
}

export async function GET() {
  const config = await loadConfig();
  return NextResponse.json(config satisfies PromoHomeConfig, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}

export async function POST(req: NextRequest) {
  const denied = rejectUnlessAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const normalized = normalizePromoHomeForSave(body);
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
  return NextResponse.json({ ok: true, ...normalized });
}
