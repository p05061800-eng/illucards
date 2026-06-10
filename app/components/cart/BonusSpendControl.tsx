"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeliveryCountry } from "@/app/lib/delivery";
import { bonusSpendRateHintRu } from "@/app/lib/bonusProgram";
import {
  displayCurrencyForDelivery,
  formatCardPrice,
  rubFromByn,
} from "@/app/lib/formatPrice";

type Props = {
  bonusBalance: number;
  bonusSpendPoints: number;
  maxBonusSpendPoints: number;
  bonusDiscountByn: number;
  deliveryCountry: DeliveryCountry | null;
  bonusPointsFromThisCart: number;
  onSpendChange: (points: number) => void;
};

export function BonusSpendControl({
  bonusBalance,
  bonusSpendPoints,
  maxBonusSpendPoints,
  bonusDiscountByn,
  deliveryCountry,
  bonusPointsFromThisCart,
  onSpendChange,
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const priceCurrency = displayCurrencyForDelivery(deliveryCountry);

  useEffect(() => {
    setDraft(null);
  }, [maxBonusSpendPoints]);

  const commitDraft = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed === "") {
        onSpendChange(0);
        setDraft(null);
        return;
      }
      const n = Math.floor(Number(trimmed));
      if (!Number.isFinite(n) || n < 0) {
        setDraft(null);
        return;
      }
      onSpendChange(Math.min(maxBonusSpendPoints, n));
      setDraft(null);
    },
    [maxBonusSpendPoints, onSpendChange],
  );

  const inputValue =
    draft ??
    (bonusSpendPoints > 0 ? String(bonusSpendPoints) : "");

  return (
    <div className="rounded-lg border border-amber-400/20 bg-amber-950/25 px-2.5 py-2 text-xs text-amber-100/95">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <span className="font-semibold text-amber-50">
          {bonusBalance.toLocaleString("ru-RU")} баллов
        </span>
        {bonusPointsFromThisCart > 0 ? (
          <span className="tabular-nums text-amber-200/80">
            +{bonusPointsFromThisCart.toLocaleString("ru-RU")} с заказом
          </span>
        ) : null}
      </div>

      {deliveryCountry && bonusBalance > 0 && maxBonusSpendPoints > 0 ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="shrink-0 text-amber-200/80">Списать</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            aria-label="Сколько баллов списать"
            value={inputValue}
            placeholder="0"
            onChange={(e) => {
              setDraft(e.target.value.replace(/[^\d]/g, ""));
            }}
            onBlur={() => {
              if (draft != null) commitDraft(draft);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draft != null) {
                commitDraft(draft);
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-[4.5rem] rounded-md border border-amber-400/35 bg-black/45 px-2 py-1 text-center text-sm font-semibold tabular-nums text-amber-50 outline-none ring-0 focus:border-amber-400/70"
          />
          <button
            type="button"
            className="rounded-md border border-amber-400/35 px-2 py-1 text-[11px] font-medium text-amber-100 transition hover:bg-amber-500/15"
            onClick={() => {
              setDraft(null);
              onSpendChange(maxBonusSpendPoints);
            }}
          >
            Макс
          </button>
          <button
            type="button"
            className="rounded-md border border-amber-400/25 px-2 py-1 text-[11px] text-amber-200/75 transition hover:bg-amber-500/10"
            onClick={() => {
              setDraft(null);
              onSpendChange(0);
            }}
          >
            0
          </button>
          {bonusSpendPoints > 0 ? (
            <span className="ml-auto tabular-nums text-[11px] text-amber-200/85">
              −
              {formatCardPrice(
                bonusDiscountByn,
                priceCurrency,
                priceCurrency === "RUB" ? rubFromByn(bonusDiscountByn) : undefined,
              )}
            </span>
          ) : null}
        </div>
      ) : null}

      {deliveryCountry ? (
        <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-amber-200/55">
          {bonusSpendRateHintRu(deliveryCountry)}
        </p>
      ) : null}
    </div>
  );
}
