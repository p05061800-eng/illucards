"use client";

import { Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useCardRatings } from "@/app/context/CardRatingsContext";

export function InteractiveRating({
  cardId,
  compact,
}: {
  cardId: string;
  /** Меньшие звёзды и подписи на странице товара */
  compact?: boolean;
}) {
  const { submitVote } = useCardRatings();
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<number | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(`illucards_rated_${cardId}`);
      if (v != null) {
        const n = parseInt(v, 10);
        if (n >= 1 && n <= 5) setMine(n);
      }
    } catch {
      /* ignore */
    }
  }, [cardId]);

  const pick = useCallback(
    async (stars: number) => {
      if (mine != null || busy) return;
      setBusy(true);
      try {
        const r = await submitVote(cardId, stars);
        if (r.ok) setMine(stars);
      } finally {
        setBusy(false);
      }
    },
    [cardId, mine, busy, submitVote]
  );

  const starClass = compact ? "h-5 w-5" : "h-7 w-7";
  const labelClass = compact ? "text-xs text-zinc-500" : "text-sm text-zinc-500";
  const thanksClass = compact ? "text-xs text-zinc-400" : "text-sm text-zinc-400";

  if (mine != null) {
    return (
      <p className={thanksClass}>
        Ваша оценка:{" "}
        <span className="font-semibold text-amber-200">{mine}</span> из 5 — спасибо!
      </p>
    );
  }

  return (
    <div className={`flex flex-wrap items-center ${compact ? "gap-2" : "gap-3"}`}>
      <span className={labelClass}>Оцените карточку:</span>
      <div className="flex gap-0.5" role="group" aria-label="Оценка от 1 до 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={busy}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => void pick(n)}
            className="rounded-md p-0.5 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`${n} из 5`}
          >
            <Star
              className={`${starClass} ${
                n <= (hover || 0)
                  ? "fill-amber-400 text-amber-400"
                  : "fill-zinc-600 text-zinc-600"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
