"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { SpotlightSlideRow } from "@/app/lib/spotlightJson";
import { DEFAULT_SPOTLIGHT_SLIDES } from "@/app/lib/spotlightJson";

/** Интервал автопрокрутки слайдов витрины (мс). */
const SPOTLIGHT_AUTOPLAY_MS = 6500;

/** Горизонтальный жест мышью/пальцем: порог в px (как у свайпа карточки в герое). */
const SWIPE_MIN_PX = 48;

/** @deprecated Используйте SpotlightSlideRow из @/app/lib/spotlightJson */
export type SpotlightSlide = SpotlightSlideRow;

export const SPOTLIGHT_SLIDES: SpotlightSlideRow[] = DEFAULT_SPOTLIGHT_SLIDES;

type Props = {
  embedded?: boolean;
  slides: SpotlightSlideRow[];
  slideIndex: number;
  onSlideChange: Dispatch<SetStateAction<number>>;
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

  const [hoverPause, setHoverPause] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
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

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const fn = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => {
    if (list.length <= 1 || hoverPause || reducedMotion) return;

    const id = window.setInterval(() => {
      onSlideChange((prev) => (prev + 1) % list.length);
    }, SPOTLIGHT_AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [list.length, onSlideChange, hoverPause, reducedMotion]);

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
      <div
        className={`${shellClass} cursor-grab active:cursor-grabbing`}
        onMouseEnter={() => setHoverPause(true)}
        onMouseLeave={() => setHoverPause(false)}
        onPointerDown={onSpotlightPointerDown}
        onPointerUp={onSpotlightPointerUp}
        onPointerCancel={onSpotlightPointerCancel}
      >
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
                    Карточек для карусели нет: добавьте карточки в админке (Витрина →
                    этот слайд) или отметьте новинки в каталоге — иначе показывается
                    карточка выбранной категории.
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
