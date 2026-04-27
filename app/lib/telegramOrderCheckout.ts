/** Текст заказа и ссылка в Telegram через параметр `start`. */

import type { DeliveryCountry } from "./delivery";
import { deliveryCharge, formatDeliveryLineTelegram } from "./delivery";

export const TELEGRAM_ORDER_BOT_DEFAULT = "illucards_bot";

export function formatLinePriceByn(n: number): string {
  const x = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return (
    (Math.round(x * 100) / 100).toLocaleString("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + " BYN"
  );
}

export type TelegramOrderLine = { title: string; lineTotalByn: number };

/**
 * Заказ с позициями, доставкой и итогом в BYN (товары + доставка в пересчёте).
 */
export function buildTelegramOrderText(
  lines: TelegramOrderLine[],
  deliveryCountry: DeliveryCountry,
): string {
  const goodsTotal =
    Math.round(lines.reduce((s, l) => s + l.lineTotalByn, 0) * 100) / 100;
  const { amountByn: deliveryByn } = deliveryCharge(deliveryCountry);
  const grand =
    Math.round((goodsTotal + deliveryByn) * 100) / 100;

  const itemsBlock = lines
    .map((l) => `• ${l.title} — ${formatLinePriceByn(l.lineTotalByn)}`)
    .join("\n");

  const deliveryLine = formatDeliveryLineTelegram(deliveryCountry);

  return `Заказ:\n${itemsBlock}\n\n${deliveryLine}\nИтого: ${formatLinePriceByn(grand)}`;
}

/** `https://t.me/<bot>?start=<encodeURIComponent(orderText)>` */
export function telegramOrderStartUrl(
  botUsername: string,
  orderText: string,
): string {
  const bot =
    botUsername.replace(/^@/, "").trim() || TELEGRAM_ORDER_BOT_DEFAULT;
  const text = encodeURIComponent(orderText);
  return `https://t.me/${encodeURIComponent(bot)}?start=${text}`;
}
