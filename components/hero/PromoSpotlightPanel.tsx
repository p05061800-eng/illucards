"use client";

import Link from "next/link";
import {
  useCallback,
  useRef,
  type Dispatch,
  type PointerEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { SpotlightSlideRow } from "@/app/lib/spotlightJson";
import { DEFAULT_SPOTLIGHT_SLIDES } from "@/app/lib/spotlightJson";

/** Горизонтальный жест мышью/пальцем: порог в px (как у свайпа карточки в герое). */
const SWIPE_MIN_PX = 48;

/** @deprecated Используйте SpotlightSlideRow из @/app/lib/spotlightJson */
export type SpotlightSlide = SpotlightSlideRow;

export const SPOTLIGHT_SLIDES: SpotlightSlideRow[] = DEFAULT_SPOTLIGHT_SLIDES;

type Props = {
  embedded?: boolean;
  /** Меньше отступов в режиме героя «один экран». */
  compact?: boolean;
  slides: SpotlightSlideRow[];
  slideIndex: number;
  onSlideChange: Dispatch<SetStateAction<number>>;
  /** Для слайда «Новинки»: сколько новинок (для пустого состояния) */
  noveltyTotal: number;
  /** Герой: слайд «Новинки» — пустое тело слева (карточка с ценой только справа). */
  noveltiesLeftEmpty?: boolean;
  /** Цена, название карточки и кнопки под заголовком/описанием (как у «Новинки») */
  commerceFooter?: ReactNode;
};

/** Левая колонка: переключение разделов и текст слайда (без дублирующей ленты карточек). */
export function PromoSpotlightPanel({
  embedded = false,
  compact = false,
  slides,
  slideIndex,
  onSlideChange,
  noveltyTotal,
  noveltiesLeftEmpty = false,
  commerceFooter,
}: Props) {
  const list = slides.length > 0 ? slides : DEFAULT_SPOTLIGHT_SLIDES;
  const max = list.length - 1;

  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipePointerIdRef = useRef<number | null>(null);

  const clearSwipe = useCallback((el: HTMLDivElement | null, pointerId: number) => {
    swipeStartRef.current = null;
    swipePointerIdRef.current = null;
    if (!el) return;
    try {
      el.releasePointerCapture(pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const onSpotlightPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (list.length <= 1) return;
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("a, button")) return;

      swipeStartRef.current = { x: e.clientX, y: e.clientY };
      swipePointerIdRef.current = e.pointerId;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [list.length]
  );

  const onSpotlightPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (swipePointerIdRef.current !== e.pointerId) return;
      const start = swipeStartRef.current;
      clearSwipe(e.currentTarget, e.pointerId);
      if (!start || list.length <= 1) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy)) return;

      if (dx < 0) {
        onSlideChange((prev) => (prev + 1) % list.length);
      } else {
        onSlideChange((prev) => (prev - 1 + list.length) % list.length);
      }
    },
    [clearSwipe, list.length, onSlideChange]
  );

  const onSpotlightPointerCancel = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (swipePointerIdRef.current !== e.pointerId) return;
      clearSwipe(e.currentTarget, e.pointerId);
    },
    [clearSwipe]
  );

  const current = list[Math.min(slideIndex, max)]!;

  const dotsRow = (
    <div
      className={`flex justify-center gap-1.5 ${
        embedded ? (compact ? "mb-2" : "mb-4") : "mt-6"
      }`}
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
    ? compact
      ? "promo-spotlight-shell relative w-full rounded-xl border border-white/[0.08] bg-zinc-950/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      : "promo-spotlight-shell relative w-full rounded-2xl border border-white/[0.08] bg-zinc-950/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    : "relative rounded-2xl border border-white/[0.08] bg-zinc-950/40 p-5 shadow-[0_0_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-7";

  return (
    <div className="relative z-20 w-full">
      <div
        className={`${shellClass} cursor-grab active:cursor-grabbing`}
        onPointerDown={onSpotlightPointerDown}
        onPointerUp={onSpotlightPointerUp}
        onPointerCancel={onSpotlightPointerCancel}
      >
        {embedded ? dotsRow : null}

        <div
          key={slideIndex}
          className={
            embedded
              ? "promo-spotlight-body min-h-0 pt-0"
              : "min-h-[180px] sm:min-h-[200px]"
          }
        >
          {current.kind === "novelties" ? (
            <div className={compact ? "space-y-2" : "space-y-4"}>
              {embedded && noveltiesLeftEmpty ? null : (
              <>
              {/*
                В герое рядом с большой карточкой — только блок товара: без баннера витрины
                и без заголовка/описания слайда (дублируют карточку).
              */}
              {embedded && commerceFooter ? null : current.imageUrl ? (
                <div className="overflow-visible rounded-xl border border-white/10 bg-black/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current.imageUrl}
                    alt=""
                    className="block h-auto w-full max-w-full"
                  />
                </div>
              ) : null}
              {/*
                В герое блок цены/кнопок уже показывает карточку из каталога (fallback),
                даже если список «Новинки» в слайде пуст — предупреждение только путало.
              */}
              {embedded && commerceFooter ? null : (
                <div className="hero-spotlight-copy">
                  <h2 className="font-bold tracking-tight text-white">
                    {current.title}
                  </h2>
                  {current.description.trim() ? (
                    <p className="mt-2 max-w-2xl whitespace-pre-line leading-relaxed text-zinc-400">
                      {current.description}
                    </p>
                  ) : null}
                  {noveltyTotal === 0 ? (
                    <p className="mt-3 text-sm text-amber-400/90">
                      Нет карточек для показа — задайте список в админке (Витрина) или
                      новинки в каталоге.
                    </p>
                  ) : null}
                </div>
              )}
              {commerceFooter ? (
                <div
                  className={
                    embedded
                      ? compact
                        ? "border-t border-white/[0.07] pt-[clamp(0.35rem,1.2vw,0.65rem)]"
                        : "border-t border-white/[0.07] pt-[clamp(0.65rem,1.8vw,1.1rem)]"
                      : "mt-5"
                  }
                >
                  {commerceFooter}
                </div>
              ) : null}
              </>
              )}
            </div>
          ) : (
            <div className={compact ? "space-y-2" : "space-y-4"}>
              {current.imageUrl ? (
                <div className="overflow-visible rounded-xl border border-white/10 bg-black/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current.imageUrl}
                    alt=""
                    className="block h-auto w-full max-w-full"
                  />
                </div>
              ) : null}
              <div className="hero-spotlight-copy">
                <h2 className="font-bold tracking-tight text-white">
                  {current.title}
                </h2>
                {current.description.trim() ? (
                  <p className="mt-2 max-w-2xl whitespace-pre-line leading-relaxed text-zinc-400">
                    {current.description}
                  </p>
                ) : null}
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
