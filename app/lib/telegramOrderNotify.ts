import { promises as fs } from "fs";
import path from "path";
import type { DeliveryCountry } from "@/app/lib/delivery";
import { DELIVERY_COUNTRY_LABELS } from "@/app/lib/delivery";
import type { OrderLineIn } from "@/app/lib/orderTypes";
import { telegramSendMessage } from "@/app/lib/telegramBotApi";

const BOT_ORDERS_PATH = path.join(process.cwd(), "data", "bot-orders.json");

type BotOrderRecord = {
  user_id: number;
  items: OrderLineIn[];
  total: number;
  delivery: DeliveryCountry;
  status: string;
};

function escapeTelegramHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatByn(n: number): string {
  const x = Number.isFinite(n) ? n : 0;
  return `${(Math.round(x * 100) / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} BYN`;
}

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

function buildTelegramOrderMessage(record: BotOrderRecord): string {
  const lines = [
    "📦 Ваш заказ уже записан в боте:",
    "",
    ...record.items.map((item) => {
      const qty = Math.max(1, Math.floor(item.quantity));
      const subtotal = item.priceByn * qty;
      return `• ${escapeTelegramHtml(item.title)} ×${qty} — ${formatByn(subtotal)}`;
    }),
    "",
    `🚚 Доставка: ${DELIVERY_COUNTRY_LABELS[record.delivery]}`,
    `💰 Итого: ${formatByn(record.total)}`,
  ];

  return lines.join("\n");
}

export async function recordAndNotifyTelegramOrder(input: {
  orderId: string;
  userId: number;
  items: OrderLineIn[];
  total: number;
  delivery: DeliveryCountry;
}): Promise<{ recorded: boolean; sent: boolean; error?: string }> {
  const record: BotOrderRecord = {
    user_id: input.userId,
    items: input.items,
    total: Math.round(input.total * 100) / 100,
    delivery: input.delivery,
    status: "new",
  };

  try {
    await recordOrderForBot(input.orderId, record);
  } catch {
    return {
      recorded: false,
      sent: false,
      error: "Не удалось записать заказ для Telegram-бота",
    };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return { recorded: true, sent: false, error: "TELEGRAM_BOT_TOKEN не задан" };
  }

  const sent = await telegramSendMessage(
    token,
    input.userId,
    buildTelegramOrderMessage(record),
  );

  if (!sent.ok) {
    return { recorded: true, sent: false, error: sent.description };
  }

  return { recorded: true, sent: true };
}
