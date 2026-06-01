/** Inline-клавиатура заказа (callback_data обрабатывает telegram_bot/bot.py). */

export type TelegramOrderKeyboardStatus =
  | "new"
  | "confirmed"
  | "paid"
  | "shipped"
  | "sent"
  | "delivered"
  | "cancelled"
  | "canceled";

function siteLoginOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() ||
    process.env.ILLUCARDS_SITE_LOGIN_ORIGIN?.trim() ||
    "https://www.illucards.by"
  ).replace(/\/+$/, "");
}

/** Клавиатура для Telegram Bot API `reply_markup.inline_keyboard`. */
export function buildTelegramOrderInlineKeyboard(
  orderId: string,
  telegramUserId: number,
  siteStatus: TelegramOrderKeyboardStatus = "new",
): { inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> } {
  const st = siteStatus.trim().toLowerCase() as TelegramOrderKeyboardStatus;
  const uid = Math.floor(telegramUserId);
  const rows: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

  if (st === "new") {
    rows.push([
      { text: "✅ Подтвердить заказ", callback_data: `orderok:${orderId}` },
    ]);
  }
  rows.push([{ text: "❌ Отменить", callback_data: `ordercx:${orderId}` }]);

  if (
    st !== "paid" &&
    st !== "shipped" &&
    st !== "sent" &&
    st !== "delivered" &&
    st !== "cancelled" &&
    st !== "canceled"
  ) {
    rows.push([
      {
        text: "💳 Чек оплаты отправил",
        callback_data: `orderpaid:${orderId}`,
      },
    ]);
  }

  rows.push([
    {
      text: "Открыть сайт",
      url: `${siteLoginOrigin()}/?user_id=${uid}`,
    },
  ]);

  return { inline_keyboard: rows };
}
