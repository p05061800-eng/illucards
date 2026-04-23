"use client";

import { ChevronRight, Play } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CardReview } from "@/app/api/cards/route";
import type { UserReviewEntry } from "@/app/lib/userReviews";
import { CardRatingStars } from "@/app/components/CardRatingStars";
import { UserReviewForm } from "@/app/components/UserReviewForm";

function formatReviewDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function reviewCountWord(n: number): string {
  const m = n % 100;
  if (m >= 11 && m <= 14) return "отзывов";
  const mod = n % 10;
  if (mod === 1) return "отзыв";
  if (mod >= 2 && mod <= 4) return "отзыва";
  return "отзывов";
}

function ratingCountWord(n: number): string {
  const m = n % 100;
  if (m >= 11 && m <= 14) return "оценок";
  const mod = n % 10;
  if (mod === 1) return "оценка";
  if (mod >= 2 && mod <= 4) return "оценки";
  return "оценок";
}

type UnifiedReview = { key: string; r: CardReview };

function buildUnifiedReviews(
  adminReviews: CardReview[],
  userReviews: UserReviewEntry[]
): UnifiedReview[] {
  const admin: UnifiedReview[] = adminReviews.map((r, i) => ({
    key: `admin-${i}`,
    r,
  }));
  const users = [...userReviews]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((ur) => ({
      key: ur.id,
      r: {
        author: ur.author,
        rating: ur.rating,
        text: ur.text,
        date: formatReviewDate(ur.date),
        images: ur.images,
        video: ur.video ?? undefined,
      } satisfies CardReview,
    }));
  return [...admin, ...users];
}

function collectMedia(reviews: UnifiedReview[]): { type: "image" | "video"; url: string }[] {
  const seen = new Set<string>();
  const out: { type: "image" | "video"; url: string }[] = [];
  for (const { r } of reviews) {
    for (const url of r.images ?? []) {
      const u = url.trim();
      if (!u || seen.has(u)) continue;
      seen.add(u);
      out.push({ type: "image", url: u });
    }
    const v = r.video?.trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push({ type: "video", url: v });
    }
  }
  return out;
}

function HorizontalScroller({
  children,
  ariaLabel,
}: {
  children: ReactNode;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanLeft(scrollLeft > 4);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const run = () => sync();
    run();
    requestAnimationFrame(run);
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sync]);

  const scrollBy = (dir: -1 | 1) => {
    ref.current?.scrollBy({
      left: dir * Math.min(320, ref.current.clientWidth * 0.85),
      behavior: "smooth",
    });
    window.setTimeout(sync, 350);
  };

  return (
    <div className="relative">
      {canLeft ? (
        <button
          type="button"
          aria-label="Назад"
          onClick={() => scrollBy(-1)}
          className="absolute left-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-zinc-900/95 text-white shadow-lg backdrop-blur-sm transition hover:bg-zinc-800"
        >
          <ChevronRight className="h-5 w-5 rotate-180" aria-hidden />
        </button>
      ) : null}
      <div
        ref={ref}
        role="region"
        aria-label={ariaLabel}
        onScroll={sync}
        className="scrollbar-hide flex gap-2 overflow-x-auto pb-1 pl-0 pr-1 pt-1 [-webkit-overflow-scrolling:touch]"
      >
        {children}
      </div>
      {canRight ? (
        <button
          type="button"
          aria-label="Вперёд"
          onClick={() => scrollBy(1)}
          className="absolute right-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-zinc-900/95 text-white shadow-lg backdrop-blur-sm transition hover:bg-zinc-800"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function ReviewCarouselCard({ r }: { r: CardReview }) {
  return (
    <article className="flex w-[min(100%,320px)] shrink-0 flex-col rounded-2xl border border-white/[0.08] bg-zinc-950/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{r.author}</p>
          {r.date ? (
            <p className="text-xs text-zinc-500">{r.date}</p>
          ) : null}
        </div>
        <CardRatingStars value={r.rating} compact />
      </div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        Достоинства
      </p>
      <p className="text-sm leading-relaxed text-zinc-300 line-clamp-6">{r.text}</p>
    </article>
  );
}

function ReviewFullItem({ r }: { r: CardReview }) {
  const imgs = r.images ?? [];
  const vid = r.video?.trim();
  return (
    <li className="rounded-2xl border border-white/[0.07] bg-zinc-950/50 p-4 sm:p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-semibold text-white">{r.author}</span>
        <CardRatingStars value={r.rating} />
        {r.date ? (
          <span className="text-xs text-zinc-500">{r.date}</span>
        ) : null}
      </div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Достоинства
      </p>
      <p className="text-sm leading-relaxed text-zinc-300">{r.text}</p>
      {imgs.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {imgs.map((src, i) => (
            <a
              key={src + i}
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-visible rounded-xl border border-white/10 bg-zinc-900/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="block h-auto w-full max-w-full"
                style={{ objectFit: "unset" }}
              />
            </a>
          ))}
        </div>
      ) : null}
      {vid ? (
        <div className="mt-3 max-w-xl">
          <video
            src={vid}
            controls
            playsInline
            className="h-auto w-full rounded-xl border border-white/10 bg-black"
          />
        </div>
      ) : null}
    </li>
  );
}

type Props = {
  cardId: string;
  mergedAvg: number;
  mergedTotalCount: number;
  adminReviews: CardReview[];
  userReviews: UserReviewEntry[];
  onUserReviewsRefresh: () => void;
};

export function ProductReviewsSection({
  cardId,
  mergedAvg,
  mergedTotalCount,
  adminReviews,
  userReviews,
  onUserReviewsRefresh,
}: Props) {
  const unified = useMemo(
    () => buildUnifiedReviews(adminReviews, userReviews),
    [adminReviews, userReviews]
  );
  const media = useMemo(() => collectMedia(unified), [unified]);
  const textCount = unified.length;
  const ratingStr = mergedAvg.toFixed(1).replace(".", ",");
  const showChoiceBadge = mergedAvg >= 4.5 && mergedTotalCount >= 5;
  const [showAllText, setShowAllText] = useState(false);

  const scrollToMedia = () => {
    document.getElementById("product-review-media")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  };

  const scrollToFullList = () => {
    setShowAllText(true);
    window.setTimeout(() => {
      document.getElementById("product-reviews-full-list")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  return (
    <section
      id="product-reviews"
      className="border-t border-white/10 pt-6"
      aria-labelledby="product-reviews-heading"
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="product-reviews-heading"
            className="sr-only"
          >
            Отзывы покупателей
          </h2>
          <div className="flex flex-wrap items-end gap-2.5">
            <span className="text-3xl font-bold tabular-nums leading-none text-white sm:text-4xl">
              {ratingStr}
            </span>
            <div className="flex flex-col gap-1 pb-0.5">
              <div className="flex flex-wrap items-center gap-2">
                {showChoiceBadge ? (
                  <span className="inline-flex rounded-md border border-violet-400/40 bg-violet-950/60 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-200">
                    Выбор покупателей
                  </span>
                ) : null}
                <span className="text-xs text-zinc-400 sm:text-sm">
                  {mergedTotalCount} {ratingCountWord(mergedTotalCount)}
                </span>
                {textCount > 0 ? (
                  <span className="text-xs text-zinc-500 sm:text-sm">
                    · {textCount} {reviewCountWord(textCount)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        {media.length > 0 ? (
          <button
            type="button"
            onClick={scrollToMedia}
            className="text-left text-sm font-medium text-violet-300/95 underline-offset-4 transition hover:text-violet-200 hover:underline"
          >
            Смотреть все фото и видео
          </button>
        ) : null}
      </div>

      {media.length > 0 ? (
        <div id="product-review-media" className="mb-6 scroll-mt-24">
          <HorizontalScroller ariaLabel="Фото и видео из отзывов">
            {media.map((item, i) => (
              <div
                key={`${item.url}-${i}`}
                className="relative w-[min(200px,70vw)] shrink-0 overflow-visible rounded-lg border border-white/10 bg-zinc-900"
              >
                {item.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt=""
                    className="block h-auto w-full max-w-full"
                    style={{ objectFit: "unset" }}
                  />
                ) : (
                  <>
                    <video
                      src={item.url}
                      className="block h-auto w-full"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-md">
                        <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden />
                      </span>
                    </span>
                  </>
                )}
              </div>
            ))}
          </HorizontalScroller>
        </div>
      ) : null}

      {unified.length > 0 ? (
        <>
          {unified.length === 1 ? (
            <ul
              id="product-reviews-full-list"
              className="mb-6 flex flex-col gap-3 scroll-mt-24"
            >
              <ReviewFullItem r={unified[0].r} />
            </ul>
          ) : (
            <>
              <div className="mb-4">
                <HorizontalScroller ariaLabel="Отзывы">
                  {unified.map(({ key, r }) => (
                    <ReviewCarouselCard key={key} r={r} />
                  ))}
                </HorizontalScroller>
              </div>

              {!showAllText ? (
                <button
                  type="button"
                  onClick={scrollToFullList}
                  className="mb-6 w-full rounded-xl border border-violet-400/35 bg-violet-950/45 py-2.5 text-sm font-semibold text-violet-100 transition hover:border-violet-400/55 hover:bg-violet-900/55"
                >
                  Смотреть все отзывы
                </button>
              ) : null}

              {showAllText ? (
                <ul
                  id="product-reviews-full-list"
                  className="mb-8 flex flex-col gap-3 scroll-mt-24"
                >
                  {unified.map(({ key, r }) => (
                    <ReviewFullItem key={`full-${key}`} r={r} />
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </>
      ) : (
        <p className="mb-6 text-sm text-zinc-500">
          Пока нет текстовых отзывов — поделитесь впечатлением ниже.
        </p>
      )}

      <div className="rounded-xl border border-white/[0.07] bg-black/25 p-3.5 sm:p-5">
        <h3 className="mb-1 text-sm font-semibold text-white sm:text-base">
          Оставить отзыв
        </h3>
        <p className="mb-3 text-xs text-zinc-500 sm:text-sm">
          Оценка, текст и до 5 фото — отзыв появится на странице после отправки.
        </p>
        <UserReviewForm
          cardId={cardId}
          embedded
          onSubmitted={onUserReviewsRefresh}
        />
      </div>
    </section>
  );
}
