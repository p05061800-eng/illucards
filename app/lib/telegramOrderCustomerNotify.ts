import { botNotify } from "@/app/lib/telegramBotRenderApi";

const DETAILS_PROMPT =
  "✅ Заказ подтверждён менеджером.\n\n" +
  "Напишите ваши данные для доставки одним сообщением:\n" +
  "• ФИО\n" +
  "• адрес\n" +
  "• телефон";

/** После подтверждения админом — попросить данные для доставки через Render-бот. */
export async function sendOrderDetailsRequestToCustomer(
  telegramUserId: number,
): Promise<boolean> {
  if (!Number.isFinite(telegramUserId) || telegramUserId <= 0) {
    return false;
  }
  const sent = await botNotify({
    target: "customer",
    telegramUserId: Math.floor(telegramUserId),
    text: DETAILS_PROMPT,
  });
  return sent.ok;
}

export { DETAILS_PROMPT as ORDER_DETAILS_REQUEST_TEXT };
