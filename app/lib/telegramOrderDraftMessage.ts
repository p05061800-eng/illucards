import type { OrderLineIn } from "@/app/lib/orderTypes";
import type { DeliveryCountry } from "@/app/lib/delivery";
import {
  formatDeliveryLineTelegram,
  formatOrderLineTelegram,
  formatOrderTotalTelegram,
} from "@/app/lib/orderTelegramDisplay";

export const TELEGRAM_ORDER_SITE_INTRO =
  "Вы перешли с сайта IlluCards в Telegram. Сейчас продолжим здесь.";

function escapeTelegramHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildTelegramOrderDraftMessage(input: {
  orderId: string;
  items: OrderLineIn[];
  total: number;
  delivery: DeliveryCountry;
}): string {
  const itemLines = input.items.map((item) => {
    const raw = formatOrderLineTelegram(item, input.delivery);
    const body = raw.startsWith("• ") ? raw.slice(2) : raw;
    return `• ${escapeTelegramHtml(body)}`;
  });

  const lines = [
    "📦 Ваш заказ",
    "",
    ...itemLines,
    "",
    formatDeliveryLineTelegram(input.delivery),
    `💰 Итого: ${formatOrderTotalTelegram({
      items: input.items,
      delivery: input.delivery,
      totalByn: input.total,
    })}`,
  ];

  return lines.join("\n");
}

export function buildTelegramOrderDraftKeyboard(orderId: string): {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
} {
  return {
    inline_keyboard: [
      [{ text: "✅ Подтвердить заказ", callback_data: `confirm_order:${orderId}` }],
      [{ text: "❌ Отменить", callback_data: `cancel_order:${orderId}` }],
    ],
  };
}

export function buildTelegramPaymentSelectionMessage(input: {
  items: OrderLineIn[];
  delivery: DeliveryCountry;
  totalByn: number;
}): string {
  const total = formatOrderTotalTelegram({
    items: input.items,
    delivery: input.delivery,
    totalByn: input.totalByn,
  });
  return [
    "Выбери действие в меню ниже 👇",
    "",
    `💰 Итого: ${total}`,
    "",
    "Выберите способ оплаты:",
    "",
    "💳 Карта -> 💵 Перевод -> ₿ Крипта",
    "💻 Оплата -> 📸 Скрин -> 🔎 Проверка -> ✅ Готово",
  ].join("\n");
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
