import { NextResponse } from "next/server";
import {
  findBotUserByUsername,
  normalizeTelegramUsername,
} from "@/app/lib/telegramBotUsersStore";
import { botSendLoginCode } from "@/app/lib/telegramBotRenderApi";

const NOT_FOUND_MSG = "Пользователь не писал боту";

/**
 * POST /api/send-code — прокси на Render-бот (токен только на Render).
 * Локальный fallback: если бот недоступен, код в Redis сайта не выдаётся без бота.
 */
export async function POST(request: Request) {
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
  const usernameRaw = typeof o.username === "string" ? o.username : "";
  const norm = normalizeTelegramUsername(usernameRaw);
  if (!norm) {
    return NextResponse.json(
      { error: "Укажите корректный username Telegram (@username)" },
      { status: 400 },
    );
  }

  const row = await findBotUserByUsername(norm);
  if (!row) {
    return NextResponse.json({ error: NOT_FOUND_MSG }, { status: 404 });
  }

  const sent = await botSendLoginCode(
    row.username ? `@${row.username.replace(/^@/, "")}` : `@${norm}`,
  );
  if (sent.ok) {
    return NextResponse.json({ ok: true });
  }

  if (sent.status === 404) {
    return NextResponse.json({ error: NOT_FOUND_MSG }, { status: 404 });
  }

  return NextResponse.json(
    {
      error:
        sent.error.includes("chat not found") || sent.error.includes("blocked")
          ? "Не удалось отправить код. Напишите боту /start и попробуйте снова."
          : sent.error || "Не удалось отправить код через бота",
    },
    { status: sent.status >= 400 ? sent.status : 502 },
  );
}
