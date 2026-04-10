import { NextResponse } from "next/server";

/** В памяти процесса (на serverless сбрасывается между инвокациями). */
let favoritesStore: string[] = [];

export async function GET() {
  return NextResponse.json(favoritesStore);
}

export async function POST(req: Request) {
  try {
    const data = (await req.json()) as unknown;
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: "Expected JSON array" }, { status: 400 });
    }
    const ids = data.filter((x): x is string => typeof x === "string");
    favoritesStore = ids;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
}
