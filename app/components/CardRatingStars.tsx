"use client";

import { Star } from "lucide-react";

type Props = {
  value: number;
  /** Меньше звёзды в плитках каталога */
  compact?: boolean;
};

/** Ряд звёзд 0–5 (дробная оценка — частичная последняя звезда при ≥0.5). */
export function CardRatingStars({ value, compact }: Props) {
  const v = Math.min(5, Math.max(0, value));
  const full = Math.floor(v);
  const partial = v - full >= 0.5;
  const size = compact ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i < full || (i === full && partial);
        return (
          <Star
            key={i}
            className={`${size} shrink-0 ${
              filled
                ? "fill-amber-400 text-amber-400"
                : "fill-zinc-700 text-zinc-600"
            }`}
          />
        );
      })}
    </div>
  );
}
