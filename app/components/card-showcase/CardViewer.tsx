"use client";

import { useRouter } from "next/navigation";
import { useRef, type TouchEvent } from "react";
import type { StoredCard } from "../../api/cards/route";
import { ultraOrHeroBgUrl } from "../../lib/cardUltraBg";
import { CardStackVisual } from "@/components/hero/CardStackVisual";

type Props = {
  activeCard: StoredCard;
  categoryCards: StoredCard[];
  onNavigate?: (nextId: string) => void;
  /** Крупнее превью на странице товара. */
  layout?: "default" | "product";
};

function ArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={
        direction === "prev"
          ? "Предыдущая в категории"
          : "Следующая в категории"
      }
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-zinc-950/85 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-purple-400/50 hover:bg-purple-950/55 hover:shadow-[0_0_32px_rgba(168,85,247,0.5),0_0_56px_rgba(139,92,246,0.18)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/12 disabled:hover:bg-zinc-950/85 disabled:hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 md:h-12 md:w-12"
    >
      <svg
        className="h-5 w-5 md:h-[1.35rem] md:w-[1.35rem]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        {direction === "prev" ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5l7 7-7 7"
          />
        )}
      </svg>
    </button>
  );
}

const SWIPE_PX = 56;

/** Та же стопка, что на герое; стрелки листают карточки категории. */
export function CardViewer({
  activeCard,
  categoryCards,
  onNavigate,
  layout = "default",
}: Props) {
  const router = useRouter();
  const touchStartX = useRef<number | null>(null);
  const n = categoryCards.length;
  const rawIdx = categoryCards.findIndex((c) => c.id === activeCard.id);
  const idx = rawIdx >= 0 ? rawIdx : 0;
  const active = categoryCards[idx] ?? categoryCards[0];

  const go = (delta: -1 | 1) => {
    if (n <= 1) return;
    const ni = (idx + delta + n) % n;
    const nextId = categoryCards[ni]!.id;
    if (onNavigate) {
      onNavigate(nextId);
    } else {
      router.push(`/card/${nextId}`);
    }
  };

  const onTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null || n <= 1) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX == null) return;
    const dx = endX - start;
    if (Math.abs(dx) < SWIPE_PX) return;
    if (dx < 0) go(1);
    else go(-1);
  };

  const front = active?.frontImage?.trim();
  if (!active || !front) return null;

  /**
   * Страница товара: компактное превью (не «вылезает» за экран), без вложенных min()
   * в одном классе — стабильнее в Safari/Tailwind.
   */
  const productRoot =
    "relative mx-auto aspect-[3/4] w-full max-w-[min(100%,280px)] overflow-visible rounded-2xl sm:max-w-[min(100%,320px)] md:max-w-[min(100%,380px)] lg:max-w-[min(100%,440px)] xl:max-w-[min(100%,500px)] 2xl:max-w-[min(100%,560px)]";
  const defaultRoot =
    "relative mx-auto aspect-[3/4] w-[260px] max-w-[min(100%,calc(100vw-4rem))] overflow-visible rounded-2xl sm:w-[300px] lg:w-[380px] xl:w-[440px] 2xl:w-[500px]";

  const wrapMax =
    layout === "product"
      ? "max-w-[min(100%,min(92vw,820px))]"
      : "max-w-[min(100%,520px)]";

  return (
    <div className="flex w-full max-w-full items-center justify-center gap-1.5 sm:gap-4">
      <ArrowButton direction="prev" disabled={n <= 1} onClick={() => go(-1)} />

      <div
        className={`relative flex min-w-0 flex-1 touch-pan-y justify-center px-0.5 ${wrapMax}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="grid w-full min-w-0 place-items-center py-1">
          <div
            className={`relative z-0 w-full overflow-visible ${layout === "product" ? "max-w-[min(100%,560px)] shrink-0" : "max-w-full"}`}
          >
            <CardStackVisual
              key={active.id}
              card={active}
              ultraBgUrl={ultraOrHeroBgUrl(active)}
              heroStack={layout !== "product"}
              dataCartFlySource
              rootClassName={layout === "product" ? productRoot : defaultRoot}
            />
          </div>
        </div>
      </div>

      <ArrowButton direction="next" disabled={n <= 1} onClick={() => go(1)} />
    </div>
  );
}
