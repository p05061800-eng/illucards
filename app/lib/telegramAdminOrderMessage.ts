import { telegramDeleteMessage } from "@/app/lib/telegramBotApi";

function resolveAdminChatId(): number | null {
  const raw =
    process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() ||
    process.env.ILLUCARDS_TELEGRAM_ADMIN_CHAT_ID?.trim() ||
    "";
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

/** Удалить у админа сообщение о заказе (если настроены токен и чат). */
export async function deleteAdminTelegramOrderMessage(
  messageId: number,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = resolveAdminChatId();
  if (!token || chatId == null) return;
  const mid = Math.floor(messageId);
  if (!Number.isFinite(mid) || mid <= 0) return;
  await telegramDeleteMessage(token, chatId, mid);
}
