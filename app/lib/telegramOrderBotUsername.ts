import { TELEGRAM_ORDER_BOT_DEFAULT } from "@/app/lib/telegramOrderCheckout";

/** Username бота для deep-link заказа / входа (как в layout `data-telegram-order-bot`). */
export function getTelegramOrderBotUsername(): string {
  if (typeof document !== "undefined") {
    const fromDom =
      document.documentElement.getAttribute("data-telegram-order-bot") ||
      document.documentElement.getAttribute("data-telegram-bot-username");
    const trimmed = (fromDom ?? "").replace(/^@/, "").trim();
    if (trimmed) return trimmed;
  }
  const fromEnv =
    process.env.NEXT_PUBLIC_TELEGRAM_ORDER_BOT_USERNAME ||
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ||
    "";
  const fromEnvTrim = fromEnv.replace(/^@/, "").trim();
  return fromEnvTrim || TELEGRAM_ORDER_BOT_DEFAULT;
}
