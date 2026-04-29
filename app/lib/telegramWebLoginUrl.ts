import { getTelegramBotUsername } from "@/app/lib/telegramAuth";
import { TELEGRAM_ORDER_BOT_DEFAULT } from "@/app/lib/telegramOrderCheckout";
import { isValidLoginWaitId } from "@/app/lib/telegramLoginWaitKeys";

/**
 * Ссылка на бота для входа с сайта.
 * `waitId` (32 hex) — после выдачи кода бот синхронизирует на сайт, клиент опрашивает и открывает ЛК.
 */
export function telegramWebLoginDeepLink(waitId?: string | null): string {
  const raw = getTelegramBotUsername().trim() || TELEGRAM_ORDER_BOT_DEFAULT;
  const name = raw.replace(/^@/, "").trim();
  const start =
    waitId && isValidLoginWaitId(waitId)
      ? `web_login_${waitId.trim().toLowerCase()}`
      : "web_login";
  return `https://t.me/${encodeURIComponent(name)}?start=${encodeURIComponent(start)}`;
}
