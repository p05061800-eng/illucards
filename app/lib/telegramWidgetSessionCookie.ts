import crypto from "node:crypto";
import type { TelegramVerifiedProfile } from "@/app/lib/telegramAuth";

export const TELEGRAM_WIDGET_SESSION_COOKIE = "illucards_tg_widget";

function signingSecret(): string {
  return (
    process.env.TELEGRAM_WIDGET_COOKIE_SECRET?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    ""
  );
}

export function sealTelegramWidgetProfile(profile: TelegramVerifiedProfile): string {
  const secret = signingSecret();
  if (!secret) throw new Error("No TELEGRAM_BOT_TOKEN or TELEGRAM_WIDGET_COOKIE_SECRET");
  const body = Buffer.from(JSON.stringify(profile), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function unsealTelegramWidgetProfile(
  cookieValue: string | undefined,
): TelegramVerifiedProfile | null {
  if (!cookieValue || typeof cookieValue !== "string") return null;
  const secret = signingSecret();
  if (!secret) return null;
  const dot = cookieValue.indexOf(".");
  if (dot < 1) return null;
  const body = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const json = Buffer.from(body, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Record<string, unknown>;
    const id = p.telegramId;
    if (typeof id !== "number" || !Number.isFinite(id) || id <= 0) return null;
    return {
      telegramId: id,
      firstName:
        typeof p.firstName === "string" && p.firstName.trim()
          ? p.firstName.trim()
          : "Пользователь",
      lastName:
        typeof p.lastName === "string" && p.lastName.trim()
          ? p.lastName.trim()
          : null,
      username:
        typeof p.username === "string" && p.username.trim()
          ? p.username.trim()
          : null,
      photoUrl:
        typeof p.photoUrl === "string" && p.photoUrl.trim()
          ? p.photoUrl.trim()
          : null,
    };
  } catch {
    return null;
  }
}
