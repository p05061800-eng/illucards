import { NextResponse } from "next/server";
import { purgeAllOrders } from "@/app/lib/ordersStore";
import { botPurgeOrders } from "@/app/lib/telegramBotRenderApi";

function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

/** POST — удалить все заказы на сайте и в боте (только с секретом). */
export async function POST(request: Request) {
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

  const site = await purgeAllOrders();
  const bot = await botPurgeOrders();

  return NextResponse.json({
    ok: true,
    site_deleted: site.siteDeleted,
    bot_deleted: bot.ok ? bot.deleted : 0,
    bot_error: bot.ok ? undefined : bot.error,
  });
}
