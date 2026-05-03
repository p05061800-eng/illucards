import type { DeliveryCountry } from "@/app/lib/delivery";
import type { CardRarity } from "@/app/lib/cardRarityTags";

export type OrderLineIn = {
  id: string;
  title: string;
  quantity: number;
  priceByn: number;
  priceRub: number;
  /** Лицевая картинка как в корзине (опционально для старых заказов). */
  frontImage?: string;
  category?: string;
  rarity?: CardRarity;
};

export type OrderStatus =
  | "new"
  | "confirmed"
  | "shipped"
  | "sent"
  | "delivered"
  | "cancelled";

/** Запись в хранилище ORDERS (и ответ GET /api/order/:id). */
export type OrderRecord = {
  user_id?: number;
  username: string | null;
  items: OrderLineIn[];
  total: number;
  delivery: DeliveryCountry;
  status: OrderStatus;
  /** message_id уведомления админу в Telegram (пишет бот после подтверждения). */
  telegram_admin_message_id?: number;
  /** Бонусы за этот заказ уже начислены (при первом «Принят» / «Отправлен» / «Доставлен»). */
  bonus_awarded?: boolean;
  /** Сколько бонусных баллов списано при оформлении. */
  bonus_points_spent?: number;
};
