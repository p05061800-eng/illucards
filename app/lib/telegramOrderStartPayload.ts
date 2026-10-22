/** Payload для ?start=… в t.me (только A–Z, a–z, 0–9, _, -; до 64 символов). */
export function telegramOrderStartPayload(
  orderId: string,
  buyerSeq?: number | null,
): string {
  const seq =
    typeof buyerSeq === "number" &&
    Number.isFinite(buyerSeq) &&
    buyerSeq > 0
      ? Math.floor(buyerSeq)
      : 0;
  if (seq > 0) {
    return `order_${seq}`;
  }
  const id = (orderId || "").trim();
  if (!id) return "order";
  // UUID без дефисов — надёжнее в deep link, чем order_<uuid-with-dashes>.
  const compact = id.replace(/-/g, "");
  if (/^[a-f0-9]{32}$/i.test(compact)) {
    return `order_${compact}`;
  }
  return `order_${id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 56)}`;
}

export function telegramOrderBotUrl(
  botUsername: string,
  orderId: string,
  buyerSeq?: number | null,
): string {
  const bot = botUsername.replace(/^@/, "").trim();
  const start = telegramOrderStartPayload(orderId, buyerSeq);
  return `https://t.me/${encodeURIComponent(bot)}?start=${encodeURIComponent(start)}`;
}

/** Payload /start для оформления индивидуальной карточки с главной. */
export const CUSTOM_CARD_START_PAYLOAD = "custom_card";

export function telegramCustomCardOrderUrl(botUsername: string): string {
  const bot = botUsername.replace(/^@/, "").trim();
  return `https://t.me/${encodeURIComponent(bot)}?start=${CUSTOM_CARD_START_PAYLOAD}`;
}
