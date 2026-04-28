import { getTelegramBotUsername } from "@/app/lib/telegramAuth";
import { TELEGRAM_ORDER_BOT_DEFAULT } from "@/app/lib/telegramOrderCheckout";

/** Ссылка на бота для входа с сайта: обязательно передаёт payload в /start. */
export function telegramWebLoginDeepLink(): string {
  const raw = getTelegramBotUsername().trim() || TELEGRAM_ORDER_BOT_DEFAULT;
  const name = raw.replace(/^@/, "").trim();
  return `https://t.me/${encodeURIComponent(name)}?start=web_login`;
}
