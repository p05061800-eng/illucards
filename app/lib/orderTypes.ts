import type { DeliveryCountry } from "@/app/lib/delivery";

export type OrderLineIn = {
  id: string;
  title: string;
  quantity: number;
  priceByn: number;
  priceRub: number;
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
};
