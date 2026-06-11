import type { DeliveryCountry } from "@/app/lib/delivery";
import type { CardRarity } from "@/app/lib/cardRarityTags";
import type { OrderPaymentMethod } from "@/app/lib/orderPayment";

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
  /** Клиент отправил чек оплаты (корзина очищается только при `confirmed`). */
  | "paid"
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
  /** Бонусы за этот заказ уже начислены (при первом «Принят» / «Чек получен» / «Отправлен» / «Доставлен»). */
  bonus_awarded?: boolean;
  /** Сколько бонусных баллов списано при оформлении. */
  bonus_points_spent?: number;
  /** Бонусы за скидку уже фактически списаны с баланса пользователя. */
  bonus_points_deducted?: boolean;
  /** Списанные бонусы возвращены на счёт (отмена заказа). */
  bonus_points_refunded?: boolean;
  /** Способ оплаты, выбранный покупателем в Telegram после подтверждения заказа. */
  payment_method?: OrderPaymentMethod;
  /** Покупателю уже отправлено сообщение с заказом в Telegram (с сайта). */
  telegram_buyer_notified?: boolean;
  /** Адрес СДЭК, ФИО и телефон — из Telegram-бота после оплаты. */
  delivery_details?: string;
  /** Порядковый номер заказа покупателя (miheevlil1 → 1) — общий с ботом. */
  buyer_seq?: number;
  /** file_id скрина оплаты в Telegram (для синка между инстансами бота). */
  telegram_payment_proof_file_id?: string;
};
