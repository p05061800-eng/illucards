"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, type TouchEvent } from "react";
import type { CardRarity, StoredCard } from "../../api/cards/route";
import { categories } from "@/data/categories";
import { focusToStyle } from "../../lib/imageFocus";
import { RARITY_STYLES } from "../../lib/cardRarityUi";
import { Card3D } from "./Card3D";

const RARITY_LABELS: Record<CardRarity, string> = {
  common: "Обычная",
  limited: "Лимитированная",
  adult: "18+",
  novelty: "Новинки",
  hot_price: "Горячая цена",
};

function categoryGlowRgba(category: string | undefined): string {
  const n = category?.trim() ?? "";
  const found = categories.find((c) => c.name.trim() === n);
  if (found) return found.glow;
  const lower = n.toLowerCase();
  if (lower.includes("marvel")) return "rgba(220, 38, 38, 0.55)";
  if (lower.includes("dc")) return "rgba(59, 130, 246, 0.55)";
  if (lower.includes("anime")) return "rgba(168, 85, 247, 0.55)";
  return "rgba(139, 92, 246, 0.45)";
}

function safeFront(src: unknown): string | null {
  if (typeof src !== "string") return null;
  const t = src.trim();
  return t.length > 0 ? t : null;
}

function DecorCard({
  card,
  className,
  emphasis,
}: {
  card: StoredCard;
  className: string;
  /** Самая дальняя карта — выше по z, ярче, лёгкий glow категории */
  emphasis?: "rearmost" | "mid";
}) {
  const glow = categoryGlowRgba(card.category);
  const shadowStyle =
    emphasis === "rearmost"
      ? `0 0 40px ${glow}, 0 12px 32px rgba(0,0,0,0.32)`
      : `0 0 26px ${glow}, 0 12px 30px rgba(0,0,0,0.34)`;

  const src = safeFront(card.frontImage);
  if (!src) {
    return (
      <div
        className={`pointer-events-none absolute rounded-2xl bg-gradient-to-br from-zinc-700 to-purple-950/50 ring-1 ring-white/14 ${className}`}
        style={{ boxShadow: shadowStyle }}
        aria-hidden
      />
    );
  }
  return (
    <div
      className={`pointer-events-none absolute overflow-hidden rounded-2xl ring-1 ring-white/14 ${className}`}
      style={{ boxShadow: shadowStyle }}
      aria-hidden
    >
      <Image
        src={src}
        alt=""
        fill
        className={`rounded-2xl object-cover ${
          emphasis === "rearmost" ? "brightness-[1.1] contrast-[1.03]" : ""
        }`}
        style={focusToStyle(card.frontImageFocus)}
        sizes="200px"
      />
    </div>
  );
}

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

type Props = {
  cards: StoredCard[];
  activeId: string;
  /** Страница категории: листаем карточки без перехода на /card */
  onNavigate?: (nextId: string) => void;
  /** Горизонтальный свайп (стрелки) */
  enableSwipe?: boolean;
};

const SWIPE_PX = 56;

export function CardStack({
  cards,
  activeId,
  onNavigate,
  enableSwipe = true,
}: Props) {
  const router = useRouter();
  const touchStartX = useRef<number | null>(null);
  const n = cards.length;
  const rawIdx = cards.findIndex((c) => c.id === activeId);
  const idx = rawIdx >= 0 ? rawIdx : 0;
  const active = cards[idx] ?? cards[0];
  const rarity: CardRarity = active?.rarity ?? "limited";

  const prevCard = n > 1 ? cards[(idx - 1 + n) % n] : null;
  const nextCard = n > 1 ? cards[(idx + 1) % n] : null;

  const go = (delta: -1 | 1) => {
    if (n <= 1) return;
    const ni = (idx + delta + n) % n;
    const nextId = cards[ni].id;
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
    if (!enableSwipe) return;
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

  const showLeft =
    prevCard && active && prevCard.id !== active.id ? prevCard : null;
  const showRight =
    nextCard &&
    active &&
    nextCard.id !== active.id &&
    nextCard.id !== showLeft?.id
      ? nextCard
      : null;

  return (
    <div className="flex w-full max-w-full items-center justify-center gap-1.5 sm:gap-4">
      <ArrowButton
        direction="prev"
        disabled={n <= 1}
        onClick={() => go(-1)}
      />

      <div
        className="relative min-h-[min(88vw,480px)] w-full min-w-0 max-w-[min(100%,380px)] touch-pan-y px-0.5"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {showLeft ? (
          <DecorCard
            card={showLeft}
            emphasis="rearmost"
            className="left-[2%] top-[4%] z-[19] h-[77%] w-[61%] -translate-y-5 -rotate-[8deg] opacity-[0.82]"
          />
        ) : null}
        {showRight ? (
          <DecorCard
            card={showRight}
            emphasis="mid"
            className="left-[26%] top-[5%] z-[18] h-[77%] w-[61%] -translate-y-3 rotate-[8deg] opacity-[0.9]"
          />
        ) : null}

        <div
          key={active.id}
          className="card-showcase-enter relative z-20 mx-auto w-full"
        >
          <Card3D card={active} />
          <div className="mt-3 text-center animate-fade-up">
            <h3 className="text-lg font-semibold text-white">
              {active.title}
            </h3>
            <span
              className={`mt-0.5 block text-xs uppercase tracking-wide ${RARITY_STYLES[rarity]}`}
            >
              {RARITY_LABELS[rarity]}
            </span>
            <p className="mt-1 line-clamp-2 text-sm text-gray-400 transition animate-fade-up delay-100 hover:text-gray-200">
              {active.description?.trim() || "Описание скоро появится"}
            </p>
          </div>
        </div>
      </div>

      <ArrowButton
        direction="next"
        disabled={n <= 1}
        onClick={() => go(1)}
      />
    </div>
  );
}
