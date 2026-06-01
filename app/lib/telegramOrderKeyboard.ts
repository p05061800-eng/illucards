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

/** Клавиатура для Telegram Bot API `reply_markup.inline_keyboard`. */
export function buildTelegramOrderInlineKeyboard(
  orderId: string,
  _telegramUserId: number,
  siteStatus: TelegramOrderKeyboardStatus = "new",
): { inline_keyboard: Array<Array<{ text: string; callback_data?: string }>> } {
  const st = siteStatus.trim().toLowerCase() as TelegramOrderKeyboardStatus;
  const rows: Array<Array<{ text: string; callback_data?: string }>> = [];

  if (st === "new") {
    rows.push([
      { text: "✅ Подтвердить заказ", callback_data: `orderok:${orderId}` },
    ]);
  }
  rows.push([{ text: "❌ Отменить", callback_data: `ordercx:${orderId}` }]);

  return { inline_keyboard: rows };
}

export function buildTelegramPaymentMethodKeyboard(orderId: string): {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
} {
  return {
    inline_keyboard: [
      [{ text: "💳 Карта", callback_data: `orderpay:card:${orderId}` }],
      [{ text: "🪙 Криптовалюта", callback_data: `orderpay:crypto:${orderId}` }],
      [
        {
          text: "📱 По номеру телефона",
          callback_data: `orderpay:phone:${orderId}`,
        },
      ],
    ],
  };
}
