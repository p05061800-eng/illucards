import { NextResponse } from "next/server";
import { normalizeTelegramUsername } from "@/app/lib/telegramBotUsersStore";
import { upsertLoginCodeEntry } from "@/app/lib/telegramLoginCodesStore";
import { isValidLoginWaitId } from "@/app/lib/telegramLoginWaitKeys";
import { markLoginWaitReady } from "@/app/lib/telegramLoginWaitStore";

function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

/**
 * Бот (или другой доверенный сервис) регистрирует одноразовый код на сайте.
 * Нужно на Vercel: бот пишет код локально, а сайт читает Redis — без sync код не совпадёт.
 */
export async function POST(request: Request) {
  const secret = process.env.ILLUCARDS_LOGIN_CODE_SYNC_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Сервер: не настроен ILLUCARDS_LOGIN_CODE_SYNC_SECRET" },
      { status: 503 },
    );
  }

  const token = bearerToken(request);
  if (!token || token !== secret) {
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
  const codeRaw = typeof o.code === "string" ? o.code : "";
  const digits = codeRaw.replace(/\D/g, "");
  if (digits.length !== 4) {
    return NextResponse.json({ error: "Нужен 4-значный код" }, { status: 400 });
  }

  const uidRaw = o.user_id;
  const uid =
    typeof uidRaw === "number"
      ? uidRaw
      : typeof uidRaw === "string"
        ? Number(uidRaw)
        : NaN;
  if (!Number.isFinite(uid) || uid <= 0 || uid > 1e12) {
    return NextResponse.json({ error: "Некорректный user_id" }, { status: 400 });
  }

  const unDisplay =
    typeof o.username_display === "string" ? o.username_display.trim() : "";
  const unNormRaw =
    typeof o.username_norm === "string" ? o.username_norm.trim() : "";
  const norm =
    normalizeTelegramUsername(unNormRaw || unDisplay) ||
    (unDisplay ? unDisplay.replace(/^@/, "").toLowerCase() : "");

  const display =
    unDisplay.replace(/^@/, "").trim() || (norm ? norm : `id${Math.floor(uid)}`);

  const expires = Date.now() + 5 * 60 * 1000;

  try {
    await upsertLoginCodeEntry(digits, {
      user_id: Math.floor(uid),
      username_norm: norm || display.toLowerCase(),
      username_display: display,
      expires,
    });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить код" }, { status: 500 });
  }

  const waitRaw = typeof o.wait_id === "string" ? o.wait_id.trim() : "";
  if (waitRaw && isValidLoginWaitId(waitRaw)) {
    await markLoginWaitReady(waitRaw);
  }

  return NextResponse.json({ ok: true });
}
