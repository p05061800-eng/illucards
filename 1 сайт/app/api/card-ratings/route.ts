import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { VoteEntry } from "@/app/lib/mergeCardRating";

const FILE = path.join(process.cwd(), "data", "card-votes.json");

async function readVotes(): Promise<Record<string, VoteEntry>> {
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object" || Array.isArray(p)) return {};
    return p as Record<string, VoteEntry>;
  } catch {
    return {};
  }
}

export async function GET() {
  const votes = await readVotes();
  return NextResponse.json({ votes });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }
  const o = body as { cardId?: unknown; stars?: unknown };
  const cardId = typeof o.cardId === "string" ? o.cardId.trim() : "";
  const stars = Number(o.stars);
  if (
    !cardId ||
    !Number.isFinite(stars) ||
    stars < 1 ||
    stars > 5 ||
    Math.floor(stars) !== stars
  ) {
    return NextResponse.json(
      { error: "Укажите cardId и целое число звёзд 1–5." },
      { status: 400 }
    );
  }

  const votes = await readVotes();
  const cur = votes[cardId] ?? { sum: 0, count: 0 };
  votes[cardId] = {
    sum: cur.sum + stars,
    count: cur.count + 1,
  };
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(votes, null, 2), "utf-8");
  return NextResponse.json({ ok: true, entry: votes[cardId] });
}
