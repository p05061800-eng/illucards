import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getSavedDeliveryText,
  setSavedDeliveryText,
} from "@/app/lib/telegramSavedDeliveryStore";

function bearerToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

function parseUserId(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 1e12) return null;
  return Math.floor(n);
}

function authOk(request: NextRequest): boolean {
  const secret = process.env.ILLUCARDS_LOGIN_CODE_SYNC_SECRET?.trim();
  if (!secret) return false;
  const token = bearerToken(request);
  return Boolean(token && token === secret);
}

/** Бот читает сохранённые данные доставки (Redis на Vercel). */
export async function GET(request: NextRequest) {
  if (!authOk(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const uid = parseUserId(request.nextUrl.searchParams.get("user_id"));
  if (!uid) {
    return NextResponse.json({ error: "Некорректный user_id" }, { status: 400 });
  }

  const text = await getSavedDeliveryText(uid);
  if (!text) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, text });
}

/** Бот сохраняет данные доставки между заказами. */
export async function POST(request: NextRequest) {
  if (!authOk(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ожидается объект" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const uid = parseUserId(o.user_id);
  const text = typeof o.text === "string" ? o.text.trim() : "";
  if (!uid || !text) {
    return NextResponse.json({ error: "Нужны user_id и text" }, { status: 400 });
  }

  const ok = await setSavedDeliveryText(uid, text);
  if (!ok) {
    return NextResponse.json({ error: "Не удалось сохранить" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
