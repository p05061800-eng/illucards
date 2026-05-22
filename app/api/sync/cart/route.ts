import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DEFAULT_TELEGRAM_BOT_SYNC_BASE = "https://illucards-telegram-bot.onrender.com";

function botSyncBase(): string {
  return (
    process.env.TELEGRAM_BOT_SYNC_URL?.trim() ||
    process.env.TELEGRAM_SYNC_API_URL?.trim() ||
    DEFAULT_TELEGRAM_BOT_SYNC_BASE
  ).replace(/\/+$/, "");
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const secret = process.env.TELEGRAM_SYNC_API_SECRET?.trim();
  const res = await fetch(`${botSyncBase()}/api/sync/cart`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "X-Sync-Secret": secret } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  }).catch((error: unknown) => ({
    ok: false as const,
    status: 502,
    json: async () => ({
      error: error instanceof Error ? error.message : "Telegram bot sync unavailable",
    }),
  }));

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return NextResponse.json(
      data && typeof data === "object" ? data : { error: "Telegram bot sync failed" },
      { status: res.status || 502 },
    );
  }
  return NextResponse.json(data && typeof data === "object" ? data : { ok: true });
}
