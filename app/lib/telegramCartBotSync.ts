import type { DeliveryCountry } from "@/app/lib/delivery";
import type { OrderLineIn } from "@/app/lib/orderTypes";
import {
  telegramBotApiUrl,
  telegramBotSyncHeaders,
} from "@/app/lib/telegramBotRenderApi";

export type SyncOrderToTelegramBotInput = {
  orderId: string;
  userId: number;
  items: OrderLineIn[];
  total: number;
  delivery: DeliveryCountry;
  username?: string | null;
  /** Сайт уже отправил сообщение покупателю — бот не дублирует. */
  skipBuyerNotify?: boolean;
};

export type SyncCartAfterVerifyInput = {
  userId: number;
  cart: unknown[];
  deliveryCountry: string;
  grandTotal?: number;
};

function botBase(): string {
  return telegramBotApiUrl();
}

async function postBotSyncCart(
  body: Record<string, unknown>,
  label: string,
): Promise<void> {
  const url = `${botBase()}/api/sync/cart`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: telegramBotSyncHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    if (!res.ok) {
      const msg =
        typeof data?.error === "string" ? data.error : `HTTP ${res.status}`;
      console.warn(`[telegram-bot] ${label} sync/cart failed:`, msg, body);
      return;
    }
    console.info(`[telegram-bot] ${label} sync/cart ok`, {
      status: res.status,
      user_id: body.user_id,
      order_id: body.order_id,
    });
  } catch (error: unknown) {
    console.warn(
      `[telegram-bot] ${label} sync/cart unavailable:`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Синхронизация корзины после verify-code (спецификация Render API). */
export async function syncCartToTelegramBotAfterVerify(
  input: SyncCartAfterVerifyInput,
): Promise<void> {
  const items = input.cart.map((row) => {
    if (!row || typeof row !== "object") return null;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const name =
      typeof o.title === "string"
        ? o.title
        : typeof o.name === "string"
          ? o.name
          : "";
    const qty =
      typeof o.quantity === "number"
        ? o.quantity
        : typeof o.qty === "number"
          ? o.qty
          : 1;
    const price =
      typeof o.priceByn === "number"
        ? o.priceByn
        : typeof o.price === "number"
          ? o.price
          : 0;
    if (!id || !name) return null;
    return { id, name, qty, price };
  }).filter((x): x is { id: string; name: string; qty: number; price: number } => x != null);

  await postBotSyncCart(
    {
      user_id: input.userId,
      items,
      deliveryCountry: input.deliveryCountry,
      ...(input.grandTotal != null ? { grandTotal: input.grandTotal } : {}),
    },
    "verify",
  );
}

/** Пометить в боте: следующее сообщение покупателя — данные доставки по заказу. */
export async function notifyBotAwaitOrderDetails(
  userId: number,
  orderId: string,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${botBase()}/api/await-order-details`, {
      method: "POST",
      headers: telegramBotSyncHeaders(),
      body: JSON.stringify({
        user_id: userId,
        order_id: orderId,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn("[telegram-bot] await-order-details failed:", res.status);
    }
  } catch (error: unknown) {
    console.warn(
      "[telegram-bot] await-order-details unavailable:",
      error instanceof Error ? error.message : error,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function syncOrderToTelegramBot(
  input: SyncOrderToTelegramBotInput,
): Promise<void> {
  const order = {
    id: input.orderId,
    order_id: input.orderId,
    items: input.items,
    total: input.total,
    delivery: input.delivery,
    user_id: input.userId,
    status: "new",
    ...(input.username ? { username: input.username } : {}),
  };

  await postBotSyncCart(
    {
      cart: input.items,
      user_id: input.userId,
      telegram_user_id: input.userId,
      order_id: input.orderId,
      order,
      session: {
        source: "vercel_order_create",
        created_at: Date.now(),
      },
      ...(input.skipBuyerNotify ? { skip_buyer_notify: true } : {}),
    },
    "order",
  );
}
