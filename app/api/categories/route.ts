import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { parseCategoriesJson } from "@/app/lib/categoriesJson";

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
  await ensureFile();
  const data = await fs.readFile(filePath, "utf-8");
  return NextResponse.json(parseCategoriesJson(JSON.parse(data)));
}

export async function POST(req: Request) {
  await ensureFile();
  const body = await req.json();
  const parsed = parseCategoriesJson(body);
  await fs.writeFile(filePath, JSON.stringify(parsed, null, 2), "utf-8");
  return NextResponse.json({ ok: true });
}
