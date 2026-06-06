import { botNotify } from "@/app/lib/telegramBotRenderApi";

/** Удалить у админа сообщение о заказе через Render-бот. */
export async function deleteAdminTelegramOrderMessage(
  messageId: number,
): Promise<void> {
  const mid = Math.floor(messageId);
  if (!Number.isFinite(mid) || mid <= 0) return;
  await botNotify({
    target: "admin",
    action: "delete_message",
    messageId: mid,
  });
}
