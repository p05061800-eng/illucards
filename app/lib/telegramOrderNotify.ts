import { promises as fs } from "fs";
import path from "path";
import type { DeliveryCountry } from "@/app/lib/delivery";
import type { OrderLineIn } from "@/app/lib/orderTypes";

const BOT_ORDERS_PATH = path.join(process.cwd(), "data", "bot-orders.json");

type BotOrderRecord = {
  user_id: number;
  items: OrderLineIn[];
  total: number;
  delivery: DeliveryCountry;
  status: string;
  bonus_points_spent?: number;
};

async function readBotOrders(): Promise<Record<string, BotOrderRecord>> {
  try {
    const raw = await fs.readFile(BOT_ORDERS_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, BotOrderRecord>;
  } catch {
    return {};
  }
}

async function recordOrderForBot(
  orderId: string,
  record: BotOrderRecord,
): Promise<void> {
  const orders = await readBotOrders();
  const existing = orders[orderId];
  const previousStatus =
    existing && typeof existing === "object"
      ? String(existing.status || "").trim()
      : "";

  orders[orderId] = {
    ...record,
    status: previousStatus || record.status,
  };

  await fs.mkdir(path.dirname(BOT_ORDERS_PATH), { recursive: true });
  await fs.writeFile(
    BOT_ORDERS_PATH,
    JSON.stringify(orders, null, 2),
    "utf-8",
  );
}

/**
 * Локальная запись заказа для GET /api/order/{id} (fallback).
 * Сообщения в Telegram отправляет только бот на Render (deep link).
 */
export async function recordAndNotifyTelegramOrder(input: {
  orderId: string;
  userId: number;
  items: OrderLineIn[];
  total: number;
  delivery: DeliveryCountry;
  bonusPointsSpent?: number;
}): Promise<{ recorded: boolean; sent: boolean; error?: string }> {
  const record: BotOrderRecord = {
    user_id: input.userId,
    items: input.items,
    total: Math.round(input.total * 100) / 100,
    delivery: input.delivery,
    status: "new",
    ...(input.bonusPointsSpent != null && input.bonusPointsSpent > 0
      ? { bonus_points_spent: Math.floor(input.bonusPointsSpent) }
      : {}),
  };

  try {
    await recordOrderForBot(input.orderId, record);
    return { recorded: true, sent: false };
  } catch {
    return { recorded: false, sent: false, error: "Не удалось записать заказ локально" };
  }
}

/** Убрать заказ из `data/bot-orders.json` на сайте (после удаления из ЛК). */
export async function removeSiteBotOrderSnapshot(orderId: string): Promise<void> {
  const id = orderId.trim();
  if (!id) return;
  try {
    const orders = await readBotOrders();
    if (!(id in orders)) return;
    delete orders[id];
    await fs.mkdir(path.dirname(BOT_ORDERS_PATH), { recursive: true });
    await fs.writeFile(BOT_ORDERS_PATH, JSON.stringify(orders, null, 2), "utf-8");
  } catch {
    /* ignore */
  }
}
