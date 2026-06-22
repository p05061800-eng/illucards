import type { DeliveryCountry } from "@/app/lib/delivery";
import type { CartLine } from "@/app/context/CartContext";
import { getTelegramOrderBotUsername } from "@/app/lib/telegramOrderBotUsername";
import { telegramOrderBotUrl } from "@/app/lib/telegramOrderStartPayload";

export type SubmitTelegramCheckoutResult =
  | {
      ok: true;
      orderId: string;
      botUrl: string;
      telegramSent: boolean;
      syncError?: string;
    }
  | { ok: false; error: string; status?: number };

export async function submitTelegramCheckoutOrder(input: {
  userId: number;
  username?: string | null;
  cartItems: CartLine[];
  deliveryCountry: DeliveryCountry;
  orderTotalByn: number;
}): Promise<SubmitTelegramCheckoutResult> {
  const items = input.cartItems.map((l) => ({
    id: l.id,
    title: l.title.trim(),
    quantity: l.quantity,
    priceByn: l.priceByn,
    priceRub: l.priceRub,
    ...(l.frontImage?.trim() ? { frontImage: l.frontImage.trim() } : {}),
        ...(l.category?.trim() ? { category: l.category.trim() } : {}),
        ...(l.categoryOrder != null ? { categoryOrder: l.categoryOrder } : {}),
        ...(l.rarity ? { rarity: l.rarity } : {}),
  }));

  const orderPayload: Record<string, unknown> = {
    items,
    total: input.orderTotalByn,
    delivery: input.deliveryCountry,
    user_id: input.userId,
  };
  if (input.username?.trim()) {
    orderPayload.username = input.username.trim();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch("/api/order/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(orderPayload),
      signal: controller.signal,
    });
  } catch (error: unknown) {
    clearTimeout(timer);
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      error: aborted
        ? "Сервер долго не отвечает. Попробуйте ещё раз через минуту."
        : "Сеть недоступна. Попробуйте ещё раз.",
    };
  } finally {
    clearTimeout(timer);
  }

  const data: unknown = await res.json().catch(() => null);
  const orderId =
    data &&
    typeof data === "object" &&
    "order_id" in data &&
    typeof (data as { order_id: unknown }).order_id === "string"
      ? (data as { order_id: string }).order_id.trim()
      : "";
  const buyerSeq =
    data &&
    typeof data === "object" &&
    typeof (data as { buyer_seq?: unknown }).buyer_seq === "number"
      ? Math.floor((data as { buyer_seq: number }).buyer_seq)
      : undefined;
  const telegramSent = Boolean(
    data &&
      typeof data === "object" &&
      (data as { telegram_sent?: unknown }).telegram_sent === true,
  );
  const syncError =
    data &&
    typeof data === "object" &&
    typeof (data as { telegram_sync_error?: unknown }).telegram_sync_error ===
      "string"
      ? (data as { telegram_sync_error: string }).telegram_sync_error.trim()
      : "";

  if (!res.ok || !orderId) {
    const msg =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : "Не удалось оформить заказ";
    return { ok: false, error: msg, status: res.status };
  }

  const bot = getTelegramOrderBotUsername();
  const botUrl = telegramOrderBotUrl(bot, orderId, buyerSeq);
  console.info("[checkout] redirect telegram", {
    order_id: orderId,
    buyer_seq: buyerSeq,
    botUrl,
    telegram_sent: telegramSent,
    sync_error: syncError || undefined,
  });

  return {
    ok: true,
    orderId,
    botUrl,
    telegramSent,
    ...(syncError ? { syncError } : {}),
  };
}
