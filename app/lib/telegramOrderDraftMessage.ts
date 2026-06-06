import { BONUS_POINTS_PER_CARD_UNIT } from "@/app/lib/bonusProgram";
import type { OrderLineIn } from "@/app/lib/orderTypes";
import type { DeliveryCountry } from "@/app/lib/delivery";
import {
  formatBonusDiscountTelegram,
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
  bonusPointsSpent?: number;
}): string {
  const itemLines = input.items.map((item) => {
    const raw = formatOrderLineTelegram(item, input.delivery);
    const body = raw.startsWith("• ") ? raw.slice(2) : raw;
    return `• ${escapeTelegramHtml(body)}`;
  });
  const bonusEarn = input.items.reduce(
    (s, it) => s + Math.max(0, Math.floor(it.quantity)) * BONUS_POINTS_PER_CARD_UNIT,
    0,
  );
  const spent = Math.max(0, Math.floor(input.bonusPointsSpent ?? 0));
  const discountLabel = spent > 0 ? formatBonusDiscountTelegram(spent, input.delivery) : "";

  const lines = [
    "Проверьте состав и доставку. Нажмите «Подтвердить заказ» — откроются шаги оплаты. Заказ уходит админу только после подтверждения оплаты со скрином чека.",
    "",
    "📦 Ваш заказ",
    "",
    ...itemLines,
    "",
    formatDeliveryLineTelegram(input.delivery),
    ...(spent > 0
      ? [
          `Списано бонусов: ${spent.toLocaleString("ru-RU")}`,
          `Скидка бонусами: ${discountLabel}`,
        ]
      : []),
    `💰 Итого: ${formatOrderTotalTelegram({
      items: input.items,
      delivery: input.delivery,
      totalByn: input.total,
      bonusPointsSpent: spent,
    })}`,
    "",
    `⭐ Ориентировочно начислится бонусов с заказа: ~${bonusEarn.toLocaleString("ru-RU")}`,
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
  bonusPointsSpent?: number;
  bonusEarn: number;
}): string {
  const total = formatOrderTotalTelegram({
    items: input.items,
    delivery: input.delivery,
    totalByn: input.totalByn,
    bonusPointsSpent: input.bonusPointsSpent,
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
    "",
    `⭐ Ориентировочно начислится бонусов с заказа: ~${input.bonusEarn.toLocaleString("ru-RU")}`,
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
