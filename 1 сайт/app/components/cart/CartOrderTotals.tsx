"use client";

import type { DeliveryCountry } from "@/app/lib/delivery";
import { displayCurrencyForDelivery, formatCardPrice } from "@/app/lib/formatPrice";

type Props = {
  deliveryCountry: DeliveryCountry | null;
  totalPriceByn: number;
  totalPriceRub: number;
  deliveryPriceByn: number;
  deliveryPriceRub: number;
  orderTotalByn: number;
  orderTotalRub: number;
};

export function CartOrderTotals({
  deliveryCountry,
  totalPriceByn,
  totalPriceRub,
  deliveryPriceByn,
  deliveryPriceRub,
  orderTotalByn,
  orderTotalRub,
}: Props) {
  const priceCurrency = displayCurrencyForDelivery(deliveryCountry);

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
      <div className="flex items-baseline justify-between gap-2 border-t border-white/[0.08] pt-1.5">
        <span className="font-medium text-zinc-400">Итого</span>
        <span className="bg-gradient-to-r from-purple-200 to-violet-200 bg-clip-text text-base font-semibold tabular-nums text-transparent sm:text-lg">
          {deliveryCountry
            ? formatCardPrice(
                orderTotalByn,
                priceCurrency,
                priceCurrency === "RUB" ? orderTotalRub : undefined,
              )
            : "—"}
        </span>
      </div>
    </div>
  );
}
