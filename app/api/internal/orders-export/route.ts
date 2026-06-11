import { NextResponse } from "next/server";
import { exportAllOrderRecordsForBot } from "@/app/lib/ordersStore";

function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

/**
 * GET /api/internal/orders-export — полный журнал заказов для бота после redeploy.
 * Требует Authorization: Bearer ILLUCARDS_ORDER_UPDATE_SECRET
 */
export async function GET(request: Request) {
  const secret = process.env.ILLUCARDS_ORDER_UPDATE_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Сервер: не настроен ILLUCARDS_ORDER_UPDATE_SECRET" },
      { status: 503 },
    );
  }
  const token = bearerToken(request);
  if (!token || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await exportAllOrderRecordsForBot();
  return NextResponse.json({ orders });
}
