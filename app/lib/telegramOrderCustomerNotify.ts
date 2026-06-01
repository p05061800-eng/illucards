import { telegramSendMessage } from "@/app/lib/telegramBotApi";

const DETAILS_PROMPT =
  "✅ Заказ подтверждён менеджером.\n\n" +
  "Напишите ваши данные для доставки одним сообщением:\n" +
  "• ФИО\n" +
  "• адрес\n" +
  "• телефон";

/** После подтверждения админом — попросить данные для доставки. */
export async function sendOrderDetailsRequestToCustomer(
  telegramUserId: number,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || !Number.isFinite(telegramUserId) || telegramUserId <= 0) {
    return false;
  }
  const sent = await telegramSendMessage(
    token,
    Math.floor(telegramUserId),
    DETAILS_PROMPT,
  );
  return sent.ok;
}

export { DETAILS_PROMPT as ORDER_DETAILS_REQUEST_TEXT };
