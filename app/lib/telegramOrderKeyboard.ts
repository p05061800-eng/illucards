/**
 * Inline-клавиатура заказа (callback_data обрабатывает telegram_bot/bot.py).
 *
 * Вариант A (сообщение с сайта через Bot API): `confirm_order` / `cancel_order`
 * + POST /api/sync/cart с order_id (бот привязывает заказ к пользователю).
 *
 * Вариант B (рекомендуется для checkout): deep link `?start=order_<id>` —
 * превью и кнопки `orderok:` / `ordercx:` полностью от бота.
 */

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

/** Вариант A: сайт шлёт сообщение сам; order_id передаётся через POST /api/sync/cart. */
export function buildTelegramOrderSiteDirectKeyboard(): {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
} {
  return {
    inline_keyboard: [
      [{ text: "✅ Подтвердить заказ", callback_data: "confirm_order" }],
      [{ text: "❌ Отменить", callback_data: "cancel_order" }],
    ],
  };
}

export function buildTelegramPaymentMethodKeyboard(orderId: string): {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
} {
  return {
    inline_keyboard: [
      [
        { text: "💳 Карта", callback_data: `orderpay:card:${orderId}` },
        { text: "💵 Перевод", callback_data: `orderpay:phone:${orderId}` },
      ],
      [{ text: "₿ Крипта", callback_data: `orderpay:crypto:${orderId}` }],
      [
        {
          text: "◀️ К подтверждению заказа",
          callback_data: `orderback:${orderId}`,
        },
      ],
    ],
  };
}
