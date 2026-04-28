import { NextResponse } from "next/server";
import { normalizeTelegramUsername } from "@/app/lib/telegramBotUsersStore";
import { consumeLoginCode } from "@/app/lib/telegramLoginCodesStore";

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
  const codeRaw = typeof o.code === "string" ? o.code : "";

  const norm = normalizeTelegramUsername(usernameRaw);
  if (!norm) {
    return NextResponse.json(
      { error: "Укажите корректный username Telegram" },
      { status: 400 },
    );
  }

  const digits = codeRaw.replace(/\D/g, "");
  if (digits.length !== 4) {
    return NextResponse.json(
      { error: "Введите 4 цифры кода" },
      { status: 400 },
    );
  }

  const result = await consumeLoginCode(norm, digits);
  if (!result) {
    return NextResponse.json(
      { error: "Неверный или просроченный код" },
      { status: 401 },
    );
  }

  return NextResponse.json({
    ok: true,
    success: true,
    user_id: result.user_id,
    username: result.username,
  });
}
