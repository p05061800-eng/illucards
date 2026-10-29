"use client";

import Link from "next/link";
import type { CartLine } from "@/app/context/CartContext";
import {
  cartLineCopyQuantity,
  cartLineGoodsTotal,
  cartLineKey,
  isCustomOrderLine,
} from "@/app/lib/customOrderPricing";
import { formatCardPrice, type DisplayCurrency } from "@/app/lib/formatPrice";

type Props = {
  line: CartLine;
  customIndex: number | null;
  priceCurrency: DisplayCurrency;
  compact?: boolean;
  onSetQuantity: (lineKey: string, quantity: number) => void;
  onSetCopyQuantity: (lineKey: string, copyQuantity: number) => void;
  onRemove: (lineKey: string) => void;
  onTitleClick?: () => void;
};

function Stepper({
  value,
  compact,
  minusLabel,
  plusLabel,
  onMinus,
  onPlus,
}: {
  value: number;
  compact?: boolean;
  minusLabel: string;
  plusLabel: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const pad = compact ? "px-2 py-0.5" : "px-2.5 py-1";
  return (
    <div
      className={`inline-flex items-center rounded-md border border-white/12 bg-black/40 ${
        compact ? "text-xs" : "text-sm"
      }`}
    >
      <button
        type="button"
        onClick={onMinus}
        className={`${pad} text-zinc-400 transition hover:bg-white/10 hover:text-white`}
        aria-label={minusLabel}
      >
        −
      </button>
      <span className="min-w-[1.5rem] px-1 text-center tabular-nums text-zinc-200">
        {value}
      </span>
      <button
        type="button"
        onClick={onPlus}
        className={`${pad} text-zinc-400 transition hover:bg-white/10 hover:text-white`}
        aria-label={plusLabel}
      >
        +
      </button>
    </div>
  );
}

export function CartLineQtyBlock({
  line,
  customIndex,
  priceCurrency,
  compact,
  onSetQuantity,
  onSetCopyQuantity,
  onRemove,
  onTitleClick,
}: Props) {
  const key = cartLineKey(line);
  const custom = isCustomOrderLine(line);
  const copies = cartLineCopyQuantity(line);
  const totals = cartLineGoodsTotal(line);
  const priceLabel = formatCardPrice(
    totals.byn,
    priceCurrency,
    priceCurrency === "RUB" ? totals.rub : undefined,
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      {custom && customIndex != null ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300/90">
          Карточка {customIndex}
        </p>
      ) : null}
      <Link
        href={`/card/${line.id}`}
        onClick={onTitleClick}
        className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-100 transition hover:text-purple-200"
      >
        {line.title}
      </Link>
      <p
        className={`font-medium tabular-nums text-purple-200/90 ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        {priceLabel}
        {custom ? (
          <span className="font-normal text-zinc-500">
            {" "}
            · полноценная
            {copies > 0 ? ` + ${copies} коп.` : ""}
          </span>
        ) : (
          <span className="font-normal text-zinc-500">
            {" "}
            · {line.quantity} шт.
          </span>
        )}
      </p>
      {custom ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-[6.5rem] text-[11px] text-zinc-400">
              Копия −50%
            </span>
            <Stepper
              value={copies}
              compact={compact}
              minusLabel="Меньше копий этой карточки"
              plusLabel="Больше копий этой карточки"
              onMinus={() => onSetCopyQuantity(key, copies - 1)}
              onPlus={() => onSetCopyQuantity(key, copies + 1)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSetQuantity(key, 2)}
              className="text-[11px] text-violet-300/90 transition hover:text-violet-200"
            >
              Ещё одну такую
            </button>
            <button
              type="button"
              onClick={() => onRemove(key)}
              className="text-[11px] text-zinc-500 transition hover:text-red-400"
            >
              Удалить
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <Stepper
            value={line.quantity}
            compact={compact}
            minusLabel="Уменьшить"
            plusLabel="Увеличить"
            onMinus={() => onSetQuantity(key, line.quantity - 1)}
            onPlus={() => onSetQuantity(key, line.quantity + 1)}
          />
          <button
            type="button"
            onClick={() => onRemove(key)}
            className={`${
              compact ? "text-[11px]" : "text-xs"
            } text-zinc-500 transition hover:text-red-400`}
          >
            {compact ? "✕" : "Удалить"}
          </button>
        </div>
      )}
    </div>
  );
}
