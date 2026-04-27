import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type { TelegramVerifiedProfile } from "@/app/lib/telegramAuth";

const MAX_AUTH_AGE_SEC = 86400;

function verifyTelegramLogin(
  botToken: string,
  data: Record<string, unknown>
): boolean {
  const hash = data.hash;
  if (typeof hash !== "string" || !hash) return false;

  const authDate = data.auth_date;
  if (typeof authDate !== "number" && typeof authDate !== "string") {
    return false;
  }
  const ts = Number(authDate);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (now - ts > MAX_AUTH_AGE_SEC || ts - now > 60) {
    return false;
  }

  const pairs: [string, string][] = [];
  for (const key of Object.keys(data).sort()) {
    if (key === "hash") continue;
    const val = data[key];
    if (val === undefined || val === null) continue;
    const str = String(val).trim();
    if (str === "") continue;
    pairs.push([key, str]);
  }

  const checkString = pairs.map(([k, v]) => `${k}=${v}`).join("\n");
  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const hmac = crypto
    .createHmac("sha256", secretKey)
    .update(checkString)
    .digest("hex");

  try {
    if (hmac.length !== hash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Сервер: не задан TELEGRAM_BOT_TOKEN." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Пустое тело запроса." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const id = data.id;
  if (typeof id !== "number" || !Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Нет корректного id Telegram." }, { status: 400 });
  }

  if (!verifyTelegramLogin(token, data)) {
    return NextResponse.json({ ok: false, error: "Подпись Telegram недействительна." }, { status: 401 });
  }

  const firstName =
    typeof data.first_name === "string" && data.first_name.trim()
      ? data.first_name.trim()
      : "Пользователь";
  const lastName =
    typeof data.last_name === "string" && data.last_name.trim()
      ? data.last_name.trim()
      : null;
  const username =
    typeof data.username === "string" && data.username.trim()
      ? data.username.trim()
      : null;
  const photoUrl =
    typeof data.photo_url === "string" && data.photo_url.trim()
      ? data.photo_url.trim()
      : null;

  const profile: TelegramVerifiedProfile = {
    telegramId: id,
    firstName,
    lastName,
    username,
    photoUrl,
  };

  return NextResponse.json({ ok: true, profile });
}
