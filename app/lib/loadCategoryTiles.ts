import { cache } from "react";
import { promises as fs } from "fs";
import path from "path";
import {
  mergeCategoryTiles,
  parseCategoriesJson,
  type CategoryTile,
} from "@/app/lib/categoriesJson";
import { DURABLE_JSON_KEYS } from "@/app/lib/durableJson";
import { redisGetText } from "@/app/lib/redisRest";

const CATEGORIES_PATH = path.join(process.cwd(), "data", "categories.json");
const MEMO_MS = 60_000;

let memo: { at: number; tiles: CategoryTile[] } | null = null;
let inflight: Promise<CategoryTile[]> | null = null;

export function clearCategoryTilesMemo(): void {
  memo = null;
  inflight = null;
}

async function readFileTiles(): Promise<CategoryTile[]> {
  try {
    const raw = await fs.readFile(CATEGORIES_PATH, "utf-8");
    return parseCategoriesJson(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function readCategoryTiles(): Promise<CategoryTile[]> {
  const now = Date.now();
  if (memo && now - memo.at < MEMO_MS) return memo.tiles;
  if (inflight) return inflight;

  inflight = (async () => {
    const [fileTiles, redisRaw] = await Promise.all([
      readFileTiles(),
      redisGetText(DURABLE_JSON_KEYS.categories, "catalog"),
    ]);
    let redisTiles: CategoryTile[] = [];
    if (redisRaw) {
      try {
        redisTiles = parseCategoriesJson(JSON.parse(redisRaw));
      } catch {
        redisTiles = [];
      }
    }
    const tiles = mergeCategoryTiles(fileTiles, redisTiles);
    memo = { at: Date.now(), tiles };
    return tiles;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export const loadCategoryTiles = cache(readCategoryTiles);
