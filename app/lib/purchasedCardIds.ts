import { promises as fs } from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "purchased-card-ids.json");

type FileShape = { cardIds: string[] };

async function readCardIds(): Promise<string[]> {
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    const p = JSON.parse(raw) as unknown;
    if (Array.isArray(p)) {
      return p.filter((x): x is string => typeof x === "string");
    }
    if (p && typeof p === "object" && !Array.isArray(p)) {
      const ids = (p as FileShape).cardIds;
      if (Array.isArray(ids)) {
        return ids.filter((x): x is string => typeof x === "string");
      }
    }
    return [];
  } catch {
    return [];
  }
}

export async function hasPurchasedCard(cardId: string): Promise<boolean> {
  const id = cardId.trim();
  if (!id) return false;
  const all = await readCardIds();
  return all.includes(id);
}

export async function recordPurchasedCards(cardIds: string[]): Promise<void> {
  const set = new Set(await readCardIds());
  for (const c of cardIds) {
    const t = typeof c === "string" ? c.trim() : "";
    if (t) set.add(t);
  }
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const payload: FileShape = { cardIds: [...set] };
  await fs.writeFile(FILE, JSON.stringify(payload, null, 2), "utf-8");
}
