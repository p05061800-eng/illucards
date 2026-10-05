import { NextRequest, NextResponse } from "next/server";
import {
  adminSessionCookieOptions,
  credentialsMatch,
  getAdminCredentials,
  sealAdminSession,
} from "@/app/lib/adminSession";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!getAdminCredentials()) {
    return NextResponse.json(
      {
        error:
          "Вход в админку не настроен. Задайте ADMIN_LOGIN и ADMIN_PASSWORD в .env.local (и в Vercel).",
      },
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
  const rec = body as Record<string, unknown>;
  const login = typeof rec.login === "string" ? rec.login.trim() : "";
  const password = typeof rec.password === "string" ? rec.password : "";
  if (!login || !password) {
    return NextResponse.json(
      { error: "Введите логин и пароль" },
      { status: 400 },
    );
  }
  if (!credentialsMatch(login, password)) {
    return NextResponse.json(
      { error: "Неверный логин или пароль" },
      { status: 401 },
    );
  }

  let token: string;
  try {
    token = sealAdminSession(login);
  } catch {
    return NextResponse.json(
      { error: "Не задан секрет сессии администратора" },
      { status: 503 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminSessionCookieOptions(request, token, 60 * 60 * 24 * 14));
  return res;
}
