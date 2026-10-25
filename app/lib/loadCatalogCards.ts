import { cache } from "react";
import { promises as fs } from "fs";
import path from "path";
import type { StoredCard } from "@/app/api/cards/route";
import { parseCardsJson } from "@/app/lib/cardsJson";
import { DURABLE_JSON_KEYS } from "@/app/lib/durableJson";
import { redisGetText } from "@/app/lib/redisRest";

const CARDS_PATH = path.join(process.cwd(), "data", "cards.json");
const MEMO_MS = 60_000;

let memo: { at: number; cards: StoredCard[] } | null = null;
let inflight: Promise<StoredCard[]> | null = null;

export function clearCatalogCardsMemo(): void {
  memo = null;
  inflight = null;
}

async function readFileCards(): Promise<StoredCard[]> {
  try {
    const raw = await fs.readFile(CARDS_PATH, "utf-8");
    return parseCardsJson(raw);
  } catch {
    return [];
  }
}

/** Redis перекрывает git по id; карточки только из git (новые локальные) дописываются. */
function mergeCatalog(
  fileCards: StoredCard[],
  redisCards: StoredCard[],
): StoredCard[] {
  if (redisCards.length === 0) return fileCards;
  if (fileCards.length === 0) return redisCards;
  const redisIds = new Set(redisCards.map((c) => c.id));
  const extra = fileCards.filter((c) => !redisIds.has(c.id));
  return extra.length === 0 ? redisCards : [...redisCards, ...extra];
}

async function readCatalogCards(): Promise<StoredCard[]> {
  const now = Date.now();
  if (memo && now - memo.at < MEMO_MS) return memo.cards;
  if (inflight) return inflight;

  inflight = (async () => {
    const [fileCards, redisRaw] = await Promise.all([
      readFileCards(),
      redisGetText(DURABLE_JSON_KEYS.cards, "catalog"),
    ]);
    const redisCards = redisRaw ? parseCardsJson(redisRaw) : [];
    const cards = mergeCatalog(fileCards, redisCards);
    memo = { at: Date.now(), cards };
    return cards;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

/** Один каталог на запрос (metadata + page) и не чаще раза в минуту на инстанс. */
export const loadCatalogCards = cache(readCatalogCards);
