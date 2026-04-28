import { NextResponse } from "next/server";
import { getOrder } from "@/app/lib/ordersStore";

/** GET /api/order/{id} — данные заказа из ORDERS (или с диска). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }
  return NextResponse.json(order);
}
