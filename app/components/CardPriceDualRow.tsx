import type { CardPriceFields } from "@/app/lib/formatPrice";
import {
  effectiveCardPriceByn,
  effectiveCardPriceRub,
  formatCardPrice,
} from "@/app/lib/formatPrice";

export type CardPriceDualVariant = "catalog" | "product" | "rail" | "hero";

function cx(...parts: (string | undefined | false)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Props = {
  card: CardPriceFields;
  variant?: CardPriceDualVariant;
  className?: string;
  /** Доп. классы к сумме в BYN (например градиент текста). */
  byClassName?: string;
  /** Доп. классы к сумме в RUB. */
  rubClassName?: string;
};

/**
 * BYN и RUB в одной строке (слева / справа), без скачков при смене валюты в интерфейсе.
 */
export function CardPriceDualRow({
  card,
  variant = "catalog",
  className,
  byClassName,
  rubClassName,
}: Props) {
  const byn = effectiveCardPriceByn(card);
  const bynStr = formatCardPrice(byn, "BYN");
  const rubStr = formatCardPrice(byn, "RUB", effectiveCardPriceRub(card));

  if (variant === "product") {
    return (
      <div
        className={cx(
          "mb-1.5 flex w-full max-w-xl flex-nowrap items-baseline justify-between gap-3 sm:max-w-none",
          className
        )}
      >
        <span
          className={cx(
            "shrink-0 whitespace-nowrap bg-gradient-to-br from-white via-zinc-100 to-zinc-300 bg-clip-text text-3xl font-bold tabular-nums text-transparent sm:text-4xl",
            byClassName
          )}
        >
          {bynStr}
        </span>
        <span
          className={cx(
            "shrink-0 whitespace-nowrap text-right text-2xl font-bold tabular-nums text-zinc-500 sm:text-3xl",
            rubClassName
          )}
        >
          {rubStr}
        </span>
      </div>
    );
  }

  if (variant === "rail") {
    return (
      <div
        className={cx(
          "scrollbar-hide flex min-w-0 items-center justify-between gap-1.5 overflow-x-auto text-[10px] font-semibold leading-tight tabular-nums sm:text-xs",
          className
        )}
      >
        <span
          className={cx(
            "min-w-0 shrink-0 whitespace-nowrap text-purple-200",
            byClassName
          )}
        >
          {bynStr}
        </span>
        <span
          className={cx(
            "min-w-0 shrink-0 whitespace-nowrap text-zinc-400",
            rubClassName
          )}
        >
          {rubStr}
        </span>
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <div
        className={cx(
          "hero-commerce-price flex w-full min-w-0 flex-nowrap items-baseline justify-between gap-3 font-light tabular-nums tracking-tight",
          className
        )}
      >
        <span className={cx("shrink-0 whitespace-nowrap text-white", byClassName)}>
          {bynStr}
        </span>
        <span
          className={cx(
            "shrink-0 whitespace-nowrap text-right text-zinc-400",
            rubClassName
          )}
        >
          {rubStr}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cx(
        "scrollbar-hide flex min-w-0 flex-1 flex-nowrap items-center justify-between gap-2 overflow-x-auto text-sm font-semibold tabular-nums sm:text-base",
        className
      )}
    >
      <span
        className={cx(
          "shrink-0 whitespace-nowrap",
          byClassName ?? "text-white"
        )}
      >
        {bynStr}
      </span>
      <span
        className={cx(
          "shrink-0 whitespace-nowrap",
          rubClassName ?? "text-zinc-400/95"
        )}
      >
        {rubStr}
      </span>
    </div>
  );
}
