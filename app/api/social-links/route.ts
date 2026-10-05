import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/app/lib/adminSession";
import { promises as fs } from "fs";
import path from "path";
import {
  DEFAULT_SOCIAL_LINKS_CONFIG,
  normalizeSocialLinksConfig,
  parseSocialLinksConfig,
} from "@/app/lib/socialLinksJson";
import {
  DURABLE_JSON_KEYS,
  loadDurableJsonText,
  saveDurableJsonText,
} from "@/app/lib/durableJson";

const filePath = path.join(process.cwd(), "data", "social-links.json");

const defaultJson = JSON.stringify(DEFAULT_SOCIAL_LINKS_CONFIG, null, 2);

async function ensureFile() {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, defaultJson, "utf-8");
  }
}

export async function GET() {
  const data =
    (await loadDurableJsonText(DURABLE_JSON_KEYS.social, filePath)) ?? defaultJson;
  return NextResponse.json(parseSocialLinksConfig(JSON.parse(data)));
}

export async function POST(req: NextRequest) {
  const denied = rejectUnlessAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const parsed = parseSocialLinksConfig(body);
  const normalized = normalizeSocialLinksConfig(parsed);
  try {
    await saveDurableJsonText(
      DURABLE_JSON_KEYS.social,
      filePath,
      JSON.stringify(normalized, null, 2),
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Не удалось сохранить." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, config: normalized });
}
