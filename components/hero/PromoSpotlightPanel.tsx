"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, type ReactNode } from "react";
import type { SpotlightSlideRow } from "@/app/lib/spotlightJson";
import { DEFAULT_SPOTLIGHT_SLIDES } from "@/app/lib/spotlightJson";

/** @deprecated Используйте SpotlightSlideRow из @/app/lib/spotlightJson */
export type SpotlightSlide = SpotlightSlideRow;

export const SPOTLIGHT_SLIDES: SpotlightSlideRow[] = DEFAULT_SPOTLIGHT_SLIDES;

type Props = {
  embedded?: boolean;
  slides: SpotlightSlideRow[];
  slideIndex: number;
  onSlideChange: (index: number) => void;
  /** Для слайда «Новинки»: сколько новинок (для пустого состояния) */
  noveltyTotal: number;
  /** Цена, название карточки и кнопки под заголовком/описанием (как у «Новинки») */
  commerceFooter?: ReactNode;
};

/** Левая колонка: переключение разделов и текст слайда (без дублирующей ленты карточек). */
export function PromoSpotlightPanel({
  embedded = false,
  slides,
  slideIndex,
  onSlideChange,
  noveltyTotal,
  commerceFooter,
}: Props) {
  const list = slides.length > 0 ? slides : DEFAULT_SPOTLIGHT_SLIDES;
  const max = list.length - 1;

  const go = useCallback(
    (dir: -1 | 1) => {
      onSlideChange(Math.min(max, Math.max(0, slideIndex + dir)));
    },
    [max, onSlideChange, slideIndex]
  );

  const current = list[Math.min(slideIndex, max)]!;

  const dotsRow = (
    <div
      className={`flex justify-center gap-1.5 ${embedded ? "mb-4" : "mt-6"}`}
      role="tablist"
      aria-label="Разделы"
    >
      {list.map((s, i) => (
        <button
          key={`${s.id}-${i}`}
          type="button"
          onClick={() => onSlideChange(i)}
          className={`h-2 rounded-full transition-all ${
            i === slideIndex
              ? "w-7 bg-zinc-300"
              : "w-2 bg-zinc-600 hover:bg-zinc-500"
          }`}
          aria-label={
            s.kind === "novelties"
              ? s.title || "Новинки"
              : `Раздел: ${s.title}`}
          aria-current={i === slideIndex}
        />
      ))}
    </div>
  );

  const shellClass = embedded
    ? "relative w-full"
    : "relative rounded-2xl border border-white/[0.08] bg-zinc-950/40 p-5 shadow-[0_0_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-7";

  return (
    <div className="relative z-20 w-full">
      <div className={shellClass}>
        {/* На телефоне только точки — стрелки разделов скрыты (жест/точки достаточно) */}
        <div className="mb-4 hidden items-center justify-end gap-2 lg:flex">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={slideIndex <= 0}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/50 text-zinc-200 transition hover:border-zinc-500/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Предыдущий раздел"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={slideIndex >= max}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/50 text-zinc-200 transition hover:border-zinc-500/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Следующий раздел"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {embedded ? dotsRow : null}

        <div
          key={slideIndex}
          className={
            embedded
              ? "min-h-[140px] sm:min-h-[160px] pt-2 sm:pt-3"
              : "min-h-[180px] sm:min-h-[200px]"
          }
        >
          {current.kind === "novelties" ? (
            <div className="space-y-4">
              {current.imageUrl ? (
                <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current.imageUrl}
                    alt=""
                    className="max-h-40 w-full object-cover sm:max-h-44"
                  />
                </div>
              ) : null}
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {current.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                  {current.description}
                </p>
                {noveltyTotal === 0 ? (
                  <p className="mt-3 text-sm text-amber-400/90">
                    Новинок пока нет — в витрине показана карточка выбранной
                    категории.
                  </p>
                ) : null}
              </div>
              {commerceFooter ? (
                <div className="mt-5">{commerceFooter}</div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              {current.imageUrl ? (
                <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current.imageUrl}
                    alt=""
                    className="max-h-40 w-full object-cover sm:max-h-44"
                  />
                </div>
              ) : null}
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {current.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                  {current.description}
                </p>
              </div>
              {commerceFooter ? (
                <div className="mt-5">{commerceFooter}</div>
              ) : null}
              <div className="mt-5">
                <Link
                  href={current.detailHref}
                  className="inline-flex w-full items-center justify-center rounded-full border border-zinc-600/50 bg-zinc-900/70 px-5 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 sm:w-auto"
                >
                  {current.detailLabel}
                </Link>
              </div>
            </div>
          )}
        </div>

        {!embedded ? dotsRow : null}
      </div>
    </div>
  );
}
