import { getTelegramBotUsername } from "@/app/lib/telegramAuth";
import { TELEGRAM_ORDER_BOT_DEFAULT } from "@/app/lib/telegramOrderCheckout";

/** Ссылка на бота: открывается чат, пользователь нажимает /start — без `web_login`. */
export function telegramWebLoginDeepLink(): string {
  const raw = getTelegramBotUsername().trim() || TELEGRAM_ORDER_BOT_DEFAULT;
  const name = raw.replace(/^@/, "").trim();
  return `https://t.me/${encodeURIComponent(name)}`;
}
