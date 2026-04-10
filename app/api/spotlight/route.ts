import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  DEFAULT_SPOTLIGHT_SLIDES,
  normalizeSpotlightConfig,
  parseSpotlightConfig,
} from "@/app/lib/spotlightJson";

const filePath = path.join(process.cwd(), "data", "spotlight.json");

const defaultJson = JSON.stringify(
  { slides: DEFAULT_SPOTLIGHT_SLIDES },
  null,
  2
);

async function ensureFile() {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, defaultJson, "utf-8");
  }
}

export async function GET() {
  await ensureFile();
  const data = await fs.readFile(filePath, "utf-8");
  return NextResponse.json(parseSpotlightConfig(JSON.parse(data)));
}

export async function POST(req: Request) {
  await ensureFile();
  const body = await req.json();
  const parsed = parseSpotlightConfig(body);
  const normalized = normalizeSpotlightConfig(parsed);
  await fs.writeFile(
    filePath,
    JSON.stringify(normalized, null, 2),
    "utf-8"
  );
  return NextResponse.json({ ok: true, config: normalized });
}
