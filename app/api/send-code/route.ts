import { NextResponse } from "next/server";
import {
  findBotUserByUsername,
  normalizeTelegramUsername,
} from "@/app/lib/telegramBotUsersStore";
import { issueLoginCode } from "@/app/lib/telegramLoginCodesStore";
import { telegramSendMessage } from "@/app/lib/telegramBotApi";

const NOT_FOUND_MSG = "Пользователь не писал боту";

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "Сервер: не настроен TELEGRAM_BOT_TOKEN" },
      { status: 503 },
    );
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

  const usernameRaw =
    typeof (body as Record<string, unknown>).username === "string"
      ? (body as Record<string, unknown>).username
      : "";
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

  let code: string;
  try {
    code = await issueLoginCode(row.user_id, norm, row.username);
  } catch {
    return NextResponse.json(
      { error: "Не удалось создать код. Попробуйте позже." },
      { status: 500 },
    );
  }

  const text =
    `🔐 Ваш код для входа:\n\n` +
    `<code>${code}</code>\n\n` +
    `⏳ Действует 5 минут`;

  const sent = await telegramSendMessage(token, row.user_id, text);
  if (!sent.ok) {
    return NextResponse.json(
      {
        error:
          sent.description.includes("chat not found") ||
          sent.description.includes("blocked")
            ? "Не удалось отправить код. Напишите боту /start и попробуйте снова."
            : sent.description,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
