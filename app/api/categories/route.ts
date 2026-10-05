import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/app/lib/adminSession";
import { promises as fs } from "fs";
import path from "path";
import { parseCategoriesJson } from "@/app/lib/categoriesJson";
import {
  DURABLE_JSON_KEYS,
  loadDurableJsonText,
  saveDurableJsonText,
} from "@/app/lib/durableJson";

const filePath = path.join(process.cwd(), "data", "categories.json");

const defaultJson = `[
  {
    "name": "Marvel",
    "image": "/uploads/marvel.jpg"
  },
  {
    "name": "DC",
    "image": "/uploads/dc.jpg"
  },
  {
    "name": "TMNT",
    "image": "/uploads/tmnt.jpg"
  },
  {
    "name": "Stranger Things",
    "image": "/uploads/stranger.jpg"
  },
  {
    "name": "Cars",
    "image": "/uploads/cars.jpg"
  },
  {
    "name": "Anime",
    "image": "/uploads/anime.jpg"
  },
  {
    "name": "Pokemon",
    "image": "/uploads/pokemon.jpg"
  },
  {
    "name": "Football",
    "image": "/uploads/football.jpg"
  }
]`;

async function ensureFile() {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, defaultJson, "utf-8");
  }
}

export async function GET() {
  const raw = await loadDurableJsonText(DURABLE_JSON_KEYS.categories, filePath);
  const data = raw ?? defaultJson;
  return NextResponse.json(parseCategoriesJson(JSON.parse(data)));
}

export async function POST(req: NextRequest) {
  const denied = rejectUnlessAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const parsed = parseCategoriesJson(body);
  try {
    await saveDurableJsonText(
      DURABLE_JSON_KEYS.categories,
      filePath,
      JSON.stringify(parsed, null, 2),
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Не удалось сохранить." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
