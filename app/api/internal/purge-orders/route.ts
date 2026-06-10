import { NextResponse } from "next/server";

function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

/** POST — очистка заказов отключена (журнал хранится всегда). */
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

  return NextResponse.json(
    { error: "Очистка заказов отключена — журнал заказов хранится всегда." },
    { status: 403 },
  );
}
