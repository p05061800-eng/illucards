"use client";

import type { DeliveryCountry } from "@/app/lib/delivery";
import { displayCurrencyForDelivery, formatCardPrice, rubFromByn } from "@/app/lib/formatPrice";

type Props = {
  deliveryCountry: DeliveryCountry | null;
  totalPriceByn: number;
  totalPriceRub: number;
  deliveryPriceByn: number;
  deliveryPriceRub: number;
  orderTotalByn: number;
  orderTotalRub: number;
  checkoutTotalByn: number;
  checkoutTotalRub: number;
  bonusSpendPoints: number;
  bonusDiscountByn: number;
};

export function CartOrderTotals({
  deliveryCountry,
  totalPriceByn,
  totalPriceRub,
  deliveryPriceByn,
  deliveryPriceRub,
  orderTotalByn,
  orderTotalRub,
  checkoutTotalByn,
  checkoutTotalRub,
  bonusSpendPoints,
  bonusDiscountByn,
}: Props) {
  const priceCurrency = displayCurrencyForDelivery(deliveryCountry);
  const useCheckout = bonusSpendPoints > 0;

  return (
    <div className="space-y-1 text-xs sm:text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-zinc-500">Товары</span>
        <span className="tabular-nums text-zinc-200">
          {formatCardPrice(
            totalPriceByn,
            priceCurrency,
            priceCurrency === "RUB" ? totalPriceRub : undefined,
          )}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-zinc-500">Доставка</span>
        <span className="tabular-nums text-zinc-200">
          {deliveryCountry
            ? formatCardPrice(
                deliveryPriceByn,
                priceCurrency,
                priceCurrency === "RUB" ? deliveryPriceRub : undefined,
              )
            : "—"}
        </span>
      </div>
      {useCheckout && deliveryCountry ? (
        <div className="flex items-baseline justify-between gap-2 text-amber-200/85">
          <span>Бонусы</span>
          <span className="tabular-nums">
            −
            {formatCardPrice(
              bonusDiscountByn,
              priceCurrency,
              priceCurrency === "RUB" ? rubFromByn(bonusDiscountByn) : undefined,
            )}
          </span>
        </div>
      ) : null}
      <div className="flex items-baseline justify-between gap-2 border-t border-white/[0.08] pt-1.5">
        <span className="font-medium text-zinc-400">Итого</span>
        <span className="bg-gradient-to-r from-purple-200 to-violet-200 bg-clip-text text-base font-semibold tabular-nums text-transparent sm:text-lg">
          {deliveryCountry
            ? formatCardPrice(
                useCheckout ? checkoutTotalByn : orderTotalByn,
                priceCurrency,
                priceCurrency === "RUB"
                  ? useCheckout
                    ? checkoutTotalRub
                    : orderTotalRub
                  : undefined,
              )
            : "—"}
        </span>
      </div>
    </div>
  );
}
