import { NextResponse } from "next/server";
import { consumeLoginCodeByCode } from "@/app/lib/telegramLoginCodesStore";

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
  const codeRaw = typeof o.code === "string" ? o.code : "";

  const digits = codeRaw.replace(/\D/g, "");
  if (digits.length !== 4) {
    return NextResponse.json(
      { error: "Введите 4 цифры кода" },
      { status: 400 },
    );
  }

  const result = await consumeLoginCodeByCode(digits);
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
