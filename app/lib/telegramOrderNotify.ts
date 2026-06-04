import { promises as fs } from "fs";
import path from "path";
import type { DeliveryCountry } from "@/app/lib/delivery";
import type { OrderLineIn } from "@/app/lib/orderTypes";
import { telegramSendMessage } from "@/app/lib/telegramBotApi";
import {
  buildTelegramOrderDraftKeyboard,
  buildTelegramOrderDraftMessage,
  TELEGRAM_ORDER_SITE_INTRO,
} from "@/app/lib/telegramOrderDraftMessage";
import { markOrderTelegramBuyerNotified } from "@/app/lib/ordersStore";

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

function buildTelegramOrderMessage(orderId: string, record: BotOrderRecord): string {
  return buildTelegramOrderDraftMessage({
    orderId,
    items: record.items,
    total: record.total,
    delivery: record.delivery,
    bonusPointsSpent: record.bonus_points_spent,
  });
}

export async function recordAndNotifyTelegramOrder(input: {
  orderId: string;
  userId: number;
  items: OrderLineIn[];
  total: number;
  delivery: DeliveryCountry;
  bonusPointsSpent?: number;
  /** false — только запись; сообщение в чат отправит бот по deep link после редиректа с сайта */
  sendTelegramMessage?: boolean;
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

  let recorded = true;
  try {
    await recordOrderForBot(input.orderId, record);
  } catch {
    recorded = false;
  }

  if (input.sendTelegramMessage === false) {
    return { recorded, sent: false };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return {
      recorded,
      sent: false,
      error: recorded
        ? "TELEGRAM_BOT_TOKEN не задан"
        : "Заказ отправлен без локальной записи (TELEGRAM_BOT_TOKEN не задан)",
    };
  }

  const intro = await telegramSendMessage(token, input.userId, TELEGRAM_ORDER_SITE_INTRO);
  if (!intro.ok) {
    return { recorded, sent: false, error: intro.description };
  }

  const sent = await telegramSendMessage(
    token,
    input.userId,
    buildTelegramOrderMessage(input.orderId, record),
    {
      replyMarkup: buildTelegramOrderDraftKeyboard(input.orderId),
    },
  );

  if (!sent.ok) {
    return { recorded, sent: false, error: sent.description };
  }

  await markOrderTelegramBuyerNotified(input.orderId);

  return { recorded, sent: true };
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
