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
  /** Для слайда «Новинки»: текущий индекс и сколько всего (показ слева) */
  noveltyIndex: number;
  noveltyTotal: number;
  /** Контент под текстом «Новинки» в том же блоке (цена, кнопки) */
  noveltiesFooter?: ReactNode;
};

/** Левая колонка: переключение разделов и текст слайда (без дублирующей ленты карточек). */
export function PromoSpotlightPanel({
  embedded = false,
  slides,
  slideIndex,
  onSlideChange,
  noveltyIndex,
  noveltyTotal,
  noveltiesFooter,
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

  const shellClass = embedded
    ? "relative w-full"
    : "relative rounded-2xl border border-white/[0.08] bg-zinc-950/40 p-5 shadow-[0_0_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-7";

  return (
    <div className="relative z-20 w-full">
      <div className={shellClass}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="bg-gradient-to-r from-violet-300/95 to-fuchsia-400/90 bg-clip-text text-xs font-medium uppercase tracking-wider text-transparent">
            Акции и подборки
          </p>
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
                {noveltyTotal > 0 ? (
                  <p className="mt-3 text-sm font-medium text-violet-200/95">
                    Сейчас: новинка {noveltyIndex + 1} из {noveltyTotal}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-amber-400/90">
                    Новинок пока нет — в витрине показана карточка выбранной
                    категории.
                  </p>
                )}
              </div>
              {noveltiesFooter ? (
                <div className="mt-5">{noveltiesFooter}</div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
              <div className="min-w-0 flex-1">
                {current.imageUrl ? (
                  <div className="mb-4 overflow-hidden rounded-xl border border-white/10 bg-black/30 sm:mb-5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={current.imageUrl}
                      alt=""
                      className="max-h-40 w-full object-cover sm:max-h-44"
                    />
                  </div>
                ) : null}
                <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {current.title}
                </h2>
                <p className="mt-5 text-sm leading-relaxed text-zinc-400 sm:mt-6 sm:text-base">
                  {current.description}
                </p>
              </div>
              <div className="shrink-0">
                <Link
                  href={current.detailHref}
                  className="inline-flex items-center justify-center rounded-full border border-zinc-600/50 bg-zinc-900/70 px-5 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800"
                >
                  {current.detailLabel}
                </Link>
              </div>
            </div>
          )}
        </div>

        <div
          className="mt-6 flex justify-center gap-1.5"
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
      </div>
    </div>
  );
}
