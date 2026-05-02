/** Вызов Telegram Bot API с сервера (токен только на сервере). */

export async function telegramSendMessage(
  botToken: string,
  chatId: number,
  text: string,
  options: { replyMarkup?: unknown } = {},
): Promise<{ ok: true } | { ok: false; description: string }> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
      }),
      cache: "no-store",
    });
    const j = (await res.json()) as Record<string, unknown>;
    if (j.ok === true) return { ok: true };
    const desc =
      typeof j.description === "string" ? j.description : "Ошибка Telegram API";
    return { ok: false, description: desc };
  } catch {
    return { ok: false, description: "Сеть или Telegram недоступны" };
  }
}

/** Удалить сообщение в чате (например уведомление админу о заказе). */
export async function telegramDeleteMessage(
  botToken: string,
  chatId: number,
  messageId: number,
): Promise<{ ok: true } | { ok: false; description: string }> {
  const url = `https://api.telegram.org/bot${botToken}/deleteMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
      cache: "no-store",
    });
    const j = (await res.json()) as Record<string, unknown>;
    if (j.ok === true) return { ok: true };
    const desc =
      typeof j.description === "string" ? j.description : "Ошибка Telegram API";
    return { ok: false, description: desc };
  } catch {
    return { ok: false, description: "Сеть или Telegram недоступны" };
  }
}
