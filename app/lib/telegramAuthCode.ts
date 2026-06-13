/**
 * Вход по одноразовому коду из Telegram (через Render-бот или локальный fallback).
 */

import { botVerifyLoginCode } from "@/app/lib/telegramBotRenderApi";
import { telegramBotApiUrl } from "@/app/lib/telegramBotRenderApi";

export async function resolveTelegramAuthCodeToUserId(
  rawCode: string,
): Promise<number | null> {
  const code = rawCode.trim();
  if (!code) return null;

  const mapJson = process.env.TELEGRAM_AUTH_CODE_MAP?.trim();
  if (mapJson) {
    try {
      const map = JSON.parse(mapJson) as Record<string, unknown>;
      const raw = map[code];
      const uid =
        typeof raw === "number"
          ? raw
          : typeof raw === "string"
            ? Number(raw)
            : NaN;
      if (Number.isFinite(uid) && uid > 0) {
        return Math.floor(uid);
      }
    } catch {
      /* ignore */
    }
  }

  const verifyUrl = process.env.TELEGRAM_AUTH_CODE_VERIFY_URL?.trim();
  const botUrl = telegramBotApiUrl();
  const targetUrl =
    verifyUrl ||
    (botUrl ? `${botUrl}/api/verify-code` : "");

  if (targetUrl) {
    try {
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        cache: "no-store",
      });
      if (!res.ok) return null;
      const j = (await res.json()) as unknown;
      if (!j || typeof j !== "object") return null;
      const o = j as Record<string, unknown>;
      const userIdRaw = o.user_id;
      const uid =
        typeof userIdRaw === "number"
          ? userIdRaw
          : typeof userIdRaw === "string"
            ? Number(userIdRaw)
            : NaN;
      if (Number.isFinite(uid) && uid > 0) {
        return Math.floor(uid);
      }
    } catch {
      return null;
    }
  }

  const botOnly = await botVerifyLoginCode({ code });
  if (botOnly.ok) return botOnly.user_id;

  return null;
}

export function isTelegramCodeAuthConfigured(): boolean {
  return Boolean(
    process.env.TELEGRAM_AUTH_CODE_MAP?.trim() ||
      process.env.TELEGRAM_AUTH_CODE_VERIFY_URL?.trim() ||
      process.env.TELEGRAM_BOT_API_URL?.trim() ||
      process.env.TELEGRAM_SYNC_API_URL?.trim() ||
      process.env.TELEGRAM_BOT_SYNC_URL?.trim(),
  );
}
