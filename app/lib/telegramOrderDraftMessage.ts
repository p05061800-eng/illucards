import type { DeliveryCountry } from "@/app/lib/delivery";
import { DELIVERY_COUNTRY_LABELS } from "@/app/lib/delivery";
import { BONUS_POINTS_PER_CARD_UNIT } from "@/app/lib/bonusProgram";
import { bonusDiscountByn } from "@/app/lib/bonusProgram";
import type { OrderLineIn } from "@/app/lib/orderTypes";

const DELIVERY_FLAGS: Record<DeliveryCountry, string> = {
  BY: "🇧🇾",
  RU: "🇷🇺",
  UA: "🇺🇦",
  OTHER: "🌍",
};

const SITE_LOGIN_ORIGIN =
  process.env.ILLUCARDS_SITE_LOGIN_ORIGIN?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "https://www.illucards.by";

function formatByn(n: number): string {
  const x = Number.isFinite(n) ? n : 0;
  return `${(Math.round(x * 100) / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} BYN`;
}

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
  const flag = DELIVERY_FLAGS[input.delivery] ?? "🌍";
  const deliveryLabel = DELIVERY_COUNTRY_LABELS[input.delivery];
  const itemLines = input.items.map((item) => {
    const qty = Math.max(1, Math.floor(item.quantity));
    const unit = item.priceByn;
    const sub = unit * qty;
    return `• ${escapeTelegramHtml(item.title)} — ${qty} шт. × ${formatByn(unit)} = ${formatByn(sub)}`;
  });
  const bonusEarn = input.items.reduce(
    (s, it) => s + Math.max(0, Math.floor(it.quantity)) * BONUS_POINTS_PER_CARD_UNIT,
    0,
  );

  const lines = [
    "Вы перешли с сайта с черновиком заказа.",
    "",
    "Проверьте состав и доставку. Нажмите «Подтвердить заказ» — откроются шаги оплаты. Заказ уходит админу только после подтверждения оплаты со скрином чека.",
    "",
    "📦 Ваш заказ",
    "",
    ...itemLines,
    "",
    `🚚 Доставка: ${flag} ${deliveryLabel}`,
    ...(input.bonusPointsSpent && input.bonusPointsSpent > 0
      ? [
          `Списано бонусов: ${input.bonusPointsSpent.toLocaleString("ru-RU")}`,
          `Скидка бонусами: ${formatByn(
            bonusDiscountByn(input.bonusPointsSpent, input.delivery),
          )}`,
        ]
      : []),
    `💰 Итого: ${formatByn(input.total)}`,
    "",
    `⭐ Ориентировочно начислится бонусов с заказа: ~${bonusEarn.toLocaleString("ru-RU")}`,
  ];

  return lines.join("\n");
}

export function buildTelegramOrderDraftKeyboard(
  orderId: string,
  telegramUserId: number,
): {
  inline_keyboard: Array<
    Array<{ text: string; url?: string; callback_data?: string }>
  >;
} {
  const uid = Math.floor(telegramUserId);
  const siteUrl = `${SITE_LOGIN_ORIGIN.replace(/\/+$/, "")}/?user_id=${uid}`;
  return {
    inline_keyboard: [
      [{ text: "Открыть сайт", url: siteUrl }],
      [{ text: "✅ Подтвердить заказ", callback_data: `orderok:${orderId}` }],
      [{ text: "❌ Отменить", callback_data: `ordercx:${orderId}` }],
    ],
  };
}

export function buildTelegramPaymentSelectionMessage(totalByn: number, bonusEarn: number): string {
  const total = formatByn(totalByn);
  const bonus = bonusEarn.toLocaleString("ru-RU");
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
    `⭐ Ориентировочно начислится бонусов с заказа: ~${bonus}`,
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
