import { cache } from "react";
import path from "path";
import type { StoredCard } from "@/app/api/cards/route";
import { parseCardsJson } from "@/app/lib/cardsJson";
import {
  DURABLE_JSON_KEYS,
  loadDurableJsonText,
} from "@/app/lib/durableJson";

const CARDS_PATH = path.join(process.cwd(), "data", "cards.json");
const MEMO_MS = 60_000;

let memo: { at: number; cards: StoredCard[] } | null = null;
let inflight: Promise<StoredCard[]> | null = null;

export function clearCatalogCardsMemo(): void {
  memo = null;
  inflight = null;
}

async function readCatalogCards(): Promise<StoredCard[]> {
  const now = Date.now();
  if (memo && now - memo.at < MEMO_MS) return memo.cards;
  if (inflight) return inflight;

  inflight = (async () => {
    const fileData = await loadDurableJsonText(
      DURABLE_JSON_KEYS.cards,
      CARDS_PATH,
    );
    const cards = fileData ? parseCardsJson(fileData) : [];
    memo = { at: Date.now(), cards };
    return cards;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

/** Один каталог на запрос (metadata + page) и не чаще раза в минуту на инстанс. */
export const loadCatalogCards = cache(readCatalogCards);
