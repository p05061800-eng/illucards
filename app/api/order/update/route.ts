import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parseOrderPaymentMethod } from "@/app/lib/orderPayment";
import { parseOrderStatusInput } from "@/app/lib/orderStatus";
import {
  assignBuyerSeqForNewOrder,
  attachOrderOwnerIfMissing,
  getOrder,
  markOrderTelegramBuyerNotified,
  saveOrderRecord,
  updateOrderDeliveryDetails,
  updateOrderPaymentMethod,
  updateOrderPaymentProofFileId,
  updateOrderStatus,
} from "@/app/lib/ordersStore";
import { getTelegramUserState } from "@/app/lib/telegramUserStateStore";
import { bonusPointsToEarnForOrderItems } from "@/app/lib/bonusProgram";
import {
  normalizeOrderItems,
  parseDeliveryCountry,
  parseOptionalBonusPointsToSpend,
  parseOptionalTelegramUserId,
  parseOptionalUsername,
  persistOrder,
} from "@/app/lib/orderCreateShared";

/**
 * Обновление заказа (статус и/или способ оплаты) — в т.ч. из Telegram-бота.
 * Body: { order_id, status?, payment_method?, delivery_details?, telegram_payment_proof_file_id?, telegram_buyer_notified?: true }
 *
 * Если задан ILLUCARDS_ORDER_UPDATE_SECRET — требуется заголовок
 * Authorization: Bearer <secret>
 */
export async function POST(request: NextRequest) {
  const secret = process.env.ILLUCARDS_ORDER_UPDATE_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

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
  const orderId = typeof o.order_id === "string" ? o.order_id.trim() : "";
  const status = parseOrderStatusInput(o.status);
  const paymentMethod = parseOrderPaymentMethod(o.payment_method);
  const markBuyerNotified =
    o.telegram_buyer_notified === true || o.telegram_buyer_notified === "true";
  const deliveryDetailsRaw =
    typeof o.delivery_details === "string" ? o.delivery_details.trim() : "";
  const hasDeliveryDetails = deliveryDetailsRaw.length > 0;
  const paymentProofFileIdRaw =
    typeof o.telegram_payment_proof_file_id === "string"
      ? o.telegram_payment_proof_file_id.trim()
      : typeof o.payment_proof_file_id === "string"
        ? o.payment_proof_file_id.trim()
        : "";
  const hasPaymentProofFileId = paymentProofFileIdRaw.length > 0;
  const earnExpectedRaw = o.bonus_points_earn_expected;
  const earnExpectedPatch =
    typeof earnExpectedRaw === "number" && Number.isFinite(earnExpectedRaw) && earnExpectedRaw > 0
      ? Math.floor(earnExpectedRaw)
      : undefined;
  if (!orderId) {
    return NextResponse.json({ error: "Укажите order_id" }, { status: 400 });
  }
  if (
    !status &&
    !paymentMethod &&
    !markBuyerNotified &&
    !hasDeliveryDetails &&
    !hasPaymentProofFileId
  ) {
    return NextResponse.json(
      {
        error:
          "Укажите status, payment_method, delivery_details, telegram_payment_proof_file_id и/или telegram_buyer_notified",
      },
      { status: 400 },
    );
  }

  let existing = await getOrder(orderId);
  if (!existing) {
    const userId = parseOptionalTelegramUserId(o.user_id ?? o.telegramUserId);
    const items = normalizeOrderItems(o.items);
    const delivery = parseDeliveryCountry(o.delivery ?? o.delivery_country);
    const total = typeof o.total === "number" ? o.total : Number(o.total);
    if (userId != null && items && delivery && Number.isFinite(total) && total >= 0) {
      const created = await persistOrder({
        orderId,
        deliveryCountry: delivery,
        items,
        userId,
        username: parseOptionalUsername(o.username) ?? null,
        clientTotalByn: total,
      });
      if (!created.ok) {
        const buyer_seq = await assignBuyerSeqForNewOrder(userId);
        const earnFallback = bonusPointsToEarnForOrderItems(items);
        await saveOrderRecord(orderId, {
          user_id: userId,
          username: parseOptionalUsername(o.username) ?? null,
          items,
          total,
          delivery,
          status: "new",
          ...(earnFallback > 0 ? { bonus_points_earn_expected: earnFallback } : {}),
          ...(buyer_seq != null && buyer_seq > 0 ? { buyer_seq } : {}),
        });
      }
      existing = await getOrder(orderId);
    }
  } else {
    const patchUid = parseOptionalTelegramUserId(o.user_id ?? o.telegramUserId);
    if (patchUid != null) {
      existing =
        (await attachOrderOwnerIfMissing(
          orderId,
          patchUid,
          parseOptionalUsername(o.username),
        )) ?? existing;
    }
    if (existing && earnExpectedPatch != null && !(existing.bonus_points_earn_expected ?? 0)) {
      await saveOrderRecord(orderId, {
        ...existing,
        bonus_points_earn_expected: earnExpectedPatch,
      });
      existing = await getOrder(orderId);
    } else if (existing) {
      const items = normalizeOrderItems(o.items);
      if (
        items &&
        items.length > 0 &&
        (!Array.isArray(existing.items) || existing.items.length === 0)
      ) {
        const earnFallback = bonusPointsToEarnForOrderItems(items);
        await saveOrderRecord(orderId, {
          ...existing,
          items,
          ...(earnFallback > 0 ? { bonus_points_earn_expected: earnFallback } : {}),
        });
        existing = await getOrder(orderId);
      }
    }
  }

  if (markBuyerNotified) {
    const marked = await markOrderTelegramBuyerNotified(orderId);
    if (!marked.ok) {
      return NextResponse.json({ error: marked.error }, { status: marked.status });
    }
    existing = await getOrder(orderId);
  }

  if (paymentMethod) {
    const pm = await updateOrderPaymentMethod(orderId, paymentMethod);
    if (!pm.ok) {
      return NextResponse.json({ error: pm.error }, { status: pm.status });
    }
    existing = await getOrder(orderId);
  }

  if (hasDeliveryDetails) {
    const dd = await updateOrderDeliveryDetails(orderId, deliveryDetailsRaw);
    if (!dd.ok) {
      return NextResponse.json({ error: dd.error }, { status: dd.status });
    }
    existing = await getOrder(orderId);
  }

  if (hasPaymentProofFileId) {
    const pp = await updateOrderPaymentProofFileId(orderId, paymentProofFileIdRaw);
    if (!pp.ok) {
      return NextResponse.json({ error: pp.error }, { status: pp.status });
    }
    existing = await getOrder(orderId);
  }

  const bonusSpendPatch = parseOptionalBonusPointsToSpend(
    o.bonus_points_spent ?? o.bonusPointsSpent,
  );
  if (bonusSpendPatch > 0 && existing && !existing.bonus_points_deducted) {
    const patched: typeof existing = {
      ...existing,
      bonus_points_spent: bonusSpendPatch,
    };
    await saveOrderRecord(orderId, patched);
    existing = patched;
  }

  if (status) {
    if (!existing) {
      return NextResponse.json(
        {
          error:
            "Заказ не найден на сайте. Передайте user_id, items, total и delivery.",
        },
        { status: 404 },
      );
    }
    const result = await updateOrderStatus(orderId, status);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    existing = await getOrder(orderId);
  }

  const userId = existing?.user_id != null ? Math.floor(existing.user_id) : null;
  const state = userId != null && userId > 0 ? await getTelegramUserState(userId) : null;
  return NextResponse.json({
    ok: true,
    ...(state ? { bonus_points: state.bonus_points } : {}),
  });
}
