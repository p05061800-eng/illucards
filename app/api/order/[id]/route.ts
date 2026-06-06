import { NextResponse } from "next/server";
import { getOrder } from "@/app/lib/ordersStore";

function authorizeOrderRead(request: Request): boolean {
  const secret = process.env.ILLUCARDS_ORDER_UPDATE_SECRET?.trim();
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** GET /api/order/{id} — данные заказа (Bearer ILLUCARDS_ORDER_UPDATE_SECRET для бота). */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!authorizeOrderRead(request)) {
    console.warn("[order] GET unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) {
    console.warn("[order] GET not found", { id, status: 404 });
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  console.info("[order] GET ok", { id, status: 200, items: order.items?.length ?? 0 });
  return NextResponse.json({
    id,
    ...order,
    grandTotal: order.total,
  });
}
