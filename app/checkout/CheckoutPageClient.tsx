"use client";

import Link from "next/link";
import { useId } from "react";
import { TelegramCheckoutButton } from "@/components/checkout/TelegramCheckoutButton";
import { DeliveryCountryField } from "@/app/components/DeliveryCountryField";
import { CartOrderTotals } from "@/app/components/cart/CartOrderTotals";
import { useCart } from "@/app/context/CartContext";
import {
  cartLineCopyQuantity,
  cartLineKey,
  isCustomOrderLine,
} from "@/app/lib/customOrderPricing";

export default function CheckoutPageClient() {
  const {
    hydrated,
    cartItems,
    deliveryCountry,
    setDeliveryCountry,
    totalPriceByn,
    totalPriceRub,
    deliveryPriceByn,
    deliveryPriceRub,
    orderTotalByn,
    orderTotalRub,
  } = useCart();
  const deliveryFieldId = useId();

  if (!hydrated) {
    return (
      <p className="text-center text-sm text-zinc-500">Загрузка…</p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-20 pt-12 sm:px-6">
      <h1 className="mb-3 text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Заказ
      </h1>
      {cartItems.length === 0 ? (
        <p className="mb-6 text-center text-sm text-zinc-400">
          Корзина пуста — добавьте карточки, затем оформите заказ.
        </p>
      ) : (
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <ul className="mb-3 space-y-1.5 text-sm text-zinc-200">
            {(() => {
              let customN = 0;
              return cartItems.map((line) => {
              const copies = cartLineCopyQuantity(line);
              const custom = isCustomOrderLine(line);
              if (custom) customN += 1;
              return (
              <li
                key={cartLineKey(line)}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="min-w-0 truncate">
                  {custom ? `Карточка ${customN}. ` : ""}
                  {line.title}
                </span>
                <span className="shrink-0 tabular-nums text-zinc-400">
                  {custom
                    ? copies > 0
                      ? `1 + ${copies} коп.`
                      : "1"
                    : `×${line.quantity}`}
                </span>
              </li>
              );
            });
            })()}
          </ul>
          <CartOrderTotals
            deliveryCountry={deliveryCountry}
            totalPriceByn={totalPriceByn}
            totalPriceRub={totalPriceRub}
            deliveryPriceByn={deliveryPriceByn}
            deliveryPriceRub={deliveryPriceRub}
            orderTotalByn={orderTotalByn}
            orderTotalRub={orderTotalRub}
          />
        </div>
      )}
      <DeliveryCountryField
        id={deliveryFieldId}
        value={deliveryCountry}
        onChange={setDeliveryCountry}
        className="mb-6"
      />
      <TelegramCheckoutButton />
      <Link
        href="/cart"
        className="mt-6 flex w-full items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] py-3 text-sm font-medium text-zinc-400 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-zinc-200"
      >
        В корзину
      </Link>
    </div>
  );
}
