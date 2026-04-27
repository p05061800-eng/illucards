import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import path from "path";
import type { DeliveryCountry } from "@/app/lib/delivery";
import { deliveryCharge } from "@/app/lib/delivery";

const ORDERS_DIR = path.join(process.cwd(), "data", "orders");

function parseDeliveryCountry(v: unknown): DeliveryCountry | null {
  if (v === "BY" || v === "RU" || v === "UA" || v === "OTHER") return v;
  return null;
}

type OrderLineIn = {
  id: string;
  title: string;
  quantity: number;
  priceByn: number;
  priceRub: number;
};

function normalizeLines(raw: unknown): OrderLineIn[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  if (raw.length > 80) return null;
  const out: OrderLineIn[] = [];
  for (const row of raw) {
    if (typeof row !== "object" || row === null) return null;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const q = typeof o.quantity === "number" ? o.quantity : Number(o.quantity);
    const priceByn =
      typeof o.priceByn === "number" ? o.priceByn : Number(o.priceByn);
    const priceRub =
      typeof o.priceRub === "number" ? o.priceRub : Number(o.priceRub);
    if (!id || !title) return null;
    if (!Number.isFinite(q) || q < 1 || q > 99 || !Number.isInteger(q))
      return null;
    if (!Number.isFinite(priceByn) || priceByn < 0 || priceByn > 1_000_000)
      return null;
    if (!Number.isFinite(priceRub) || priceRub < 0 || priceRub > 50_000_000)
      return null;
    out.push({
      id: id.slice(0, 120),
      title: title.slice(0, 300),
      quantity: q,
      priceByn,
      priceRub: Math.round(priceRub),
    });
  }
  return out;
}

/** Создание заказа из корзины (для deep link `t.me/bot?start=order_<id>`). */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Ожидается объект JSON" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const deliveryCountry = parseDeliveryCountry(o.deliveryCountry);
  if (!deliveryCountry) {
    return NextResponse.json(
      { error: "Укажите страну доставки" },
      { status: 400 },
    );
  }

  const items = normalizeLines(o.items);
  if (!items) {
    return NextResponse.json(
      { error: "Корзина пуста или данные позиций некорректны" },
      { status: 400 },
    );
  }

  const goodsByn =
    Math.round(
      items.reduce((s, l) => s + l.priceByn * l.quantity, 0) * 100,
    ) / 100;
  const goodsRub = items.reduce((s, l) => s + l.priceRub * l.quantity, 0);
  const d = deliveryCharge(deliveryCountry);
  const orderByn = Math.round((goodsByn + d.amountByn) * 100) / 100;
  const orderTotalRub = goodsRub + d.amountRub;

  const orderId = randomUUID();
  const record = {
    id: orderId,
    createdAt: new Date().toISOString(),
    deliveryCountry,
    items,
    totals: {
      goodsByn,
      deliveryByn: d.amountByn,
      orderByn,
      goodsRub,
      deliveryRub: d.amountRub,
      orderRub: orderTotalRub,
    },
  };

  try {
    await fs.mkdir(ORDERS_DIR, { recursive: true });
    await fs.writeFile(
      path.join(ORDERS_DIR, `${orderId}.json`),
      JSON.stringify(record, null, 2),
      "utf-8",
    );
  } catch {
    return NextResponse.json(
      { error: "Не удалось сохранить заказ" },
      { status: 500 },
    );
  }

  return NextResponse.json({ orderId });
}
