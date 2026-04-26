"use client";

import type { CardPriceFields } from "@/app/lib/formatPrice";
import { formatStoredCardPrice } from "@/app/lib/formatPrice";
import { useCurrency } from "@/app/context/CurrencyContext";

export type CardPriceDualVariant = "catalog" | "product" | "rail" | "hero";

function cx(...parts: (string | undefined | false)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Props = {
  card: CardPriceFields;
  variant?: CardPriceDualVariant;
  className?: string;
  /** Классы суммы при отображении в BYN. */
  byClassName?: string;
  /** Классы суммы при отображении в RUB. */
  rubClassName?: string;
};

/**
 * Одна цена в валюте из шапки (CurrencyContext), синхронно с переключателем BYN / RUB.
 */
export function CardPriceDualRow({
  card,
  variant = "catalog",
  className,
  byClassName,
  rubClassName,
}: Props) {
  const { currency } = useCurrency();
  const label = formatStoredCardPrice(card, currency);

  const defaultProductByn =
    "shrink-0 whitespace-nowrap bg-gradient-to-br from-white via-zinc-100 to-zinc-300 bg-clip-text text-3xl font-bold tabular-nums text-transparent sm:text-4xl";
  const defaultProductRub =
    "shrink-0 whitespace-nowrap text-2xl font-bold tabular-nums text-zinc-500 sm:text-3xl";

  const defaultRailByn = "min-w-0 shrink-0 whitespace-nowrap text-purple-200";
  const defaultRailRub = "min-w-0 shrink-0 whitespace-nowrap text-zinc-400";

  const defaultHeroByn = "shrink-0 whitespace-nowrap text-white";
  const defaultHeroRub =
    "shrink-0 whitespace-nowrap text-right text-zinc-400";

  /** В сетке коллекции на телефоне рядом с кнопками — без shrink-0, иначе цена не сжимается по flex. */
  const defaultCatalogByn = "min-w-0 whitespace-nowrap text-white";
  const defaultCatalogRub = "min-w-0 whitespace-nowrap text-zinc-400/95";

  let spanClass: string;
  if (variant === "product") {
    spanClass =
      currency === "BYN"
        ? cx(byClassName ?? defaultProductByn)
        : cx(rubClassName ?? defaultProductRub);
  } else if (variant === "rail") {
    spanClass =
      currency === "BYN"
        ? cx(byClassName ?? defaultRailByn)
        : cx(rubClassName ?? defaultRailRub);
  } else if (variant === "hero") {
    spanClass =
      currency === "BYN"
        ? cx(byClassName ?? defaultHeroByn)
        : cx(rubClassName ?? defaultHeroRub);
  } else {
    spanClass =
      currency === "BYN"
        ? cx(byClassName ?? defaultCatalogByn)
        : cx(rubClassName ?? defaultCatalogRub);
  }

  if (variant === "product") {
    return (
      <div
        className={cx(
          "mb-1.5 flex w-full max-w-xl flex-nowrap items-baseline justify-start gap-3 sm:max-w-none",
          className
        )}
      >
        <span className={spanClass}>{label}</span>
      </div>
    );
  }

  if (variant === "rail") {
    return (
      <div
        className={cx(
          "flex min-w-0 items-center justify-start gap-1.5 text-[10px] font-semibold leading-tight tabular-nums sm:text-xs",
          className
        )}
      >
        <span className={spanClass}>{label}</span>
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <div
        className={cx(
          "hero-commerce-price flex w-full min-w-0 flex-nowrap items-baseline justify-start gap-3 font-light tabular-nums tracking-tight",
          className
        )}
      >
        <span className={spanClass}>{label}</span>
      </div>
    );
  }

  return (
    <div
      className={cx(
        "flex min-w-0 flex-1 flex-nowrap items-center justify-start gap-1.5 text-xs font-semibold tabular-nums sm:gap-2 sm:text-sm md:text-base",
        className
      )}
    >
      <span className={spanClass}>{label}</span>
    </div>
  );
}
