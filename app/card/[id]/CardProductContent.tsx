"use client";

import Link from "next/link";
import { BadgePercent, ShieldCheck, Star, Truck } from "lucide-react";
import { useState } from "react";
import type { CardRarity, StoredCard } from "../../api/cards/route";
import { PurchaseModal } from "../../components/PurchaseModal";
import { useCurrency } from "../../context/CurrencyContext";
import { useAddToCartWithFeedback } from "../../lib/cartUx/useAddToCartWithFeedback";
import { collectionSectionId } from "../../lib/collectionAnchor";
import { focusToStyle } from "../../lib/imageFocus";
import { formatCardPrice } from "../../lib/formatPrice";
import { CardProductGallery } from "./CardProductGallery";

const RARITY_LABELS: Record<CardRarity, string> = {
  common: "Обычная",
  limited: "Лимитированная",
  adult: "18+",
  novelty: "Новинки",
  hot_price: "Горячая цена",
};

const RARITY_BADGE: Record<CardRarity, string> = {
  common:
    "border-zinc-500/50 bg-zinc-900/90 text-zinc-200 shadow-[0_0_12px_rgba(161,161,170,0.25)]",
  limited:
    "border-amber-400/50 bg-amber-950/80 text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.35)]",
  adult:
    "border-rose-400/50 bg-rose-950/80 text-rose-100 shadow-[0_0_16px_rgba(244,63,94,0.35)]",
  novelty:
    "border-emerald-400/50 bg-emerald-950/80 text-emerald-100 shadow-[0_0_16px_rgba(52,211,153,0.35)]",
  hot_price:
    "border-fuchsia-400/60 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_20px_rgba(217,70,239,0.45)]",
};

function resolveByIds(
  ids: string[] | undefined,
  all: StoredCard[] | undefined
): StoredCard[] {
  if (!ids?.length || !all?.length) return [];
  const map = new Map(all.map((c) => [c.id, c]));
  return ids.map((id) => map.get(id)).filter((c): c is StoredCard => Boolean(c));
}

function StarRow({ value }: { value: number }) {
  const full = Math.min(5, Math.max(0, value));
  const whole = Math.floor(full);
  const partial = full - whole >= 0.5;
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i < whole || (i === whole && partial);
        return (
          <Star
            key={i}
            className={`h-5 w-5 shrink-0 ${
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

function CardMiniRail({
  title,
  cards,
}: {
  title: string;
  cards: StoredCard[];
}) {
  const { currency } = useCurrency();
  if (cards.length === 0) return null;
  return (
    <section className="border-t border-white/10 pt-10">
      <h2 className="mb-4 text-lg font-bold text-white">{title}</h2>
      <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-2 sm:gap-4">
        {cards.map((c) => {
          const img = c.frontImage?.trim();
          return (
            <Link
              key={c.id}
              href={`/card/${c.id}`}
              className="group flex w-[min(168px,42vw)] shrink-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950/60 transition hover:border-purple-500/40 hover:bg-zinc-900/80 sm:w-[168px]"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-900">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                    style={focusToStyle(c.frontImageFocus)}
                  />
                ) : null}
              </div>
              <div className="flex min-h-[3.5rem] flex-col gap-1 p-2">
                <p className="line-clamp-2 text-xs font-medium leading-tight text-zinc-100">
                  {c.title}
                </p>
                <p className="text-xs font-semibold tabular-nums text-purple-200">
                  {formatCardPrice(c.price, currency)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

type Props = {
  card: StoredCard;
  categoryCards: StoredCard[];
  /** Список всех карточек для блоков «вместе» / «рекомендуем». */
  allCards?: StoredCard[];
};

export default function CardProductContent({
  card,
  categoryCards,
  allCards = [],
}: Props) {
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const addToCartWithFeedback = useAddToCartWithFeedback();
  const { currency } = useCurrency();
  const rarity = card.rarity ?? "limited";
  const backHref = "/#collection";
  const inStock = card.inStock !== false;
  const rawRating = Number(card.ratingAvg);
  const rating = Number.isFinite(rawRating)
    ? Math.min(5, Math.max(0, rawRating))
    : 4.8;
  const reviewCount = card.reviewCount ?? card.reviews?.length ?? 0;
  const reviews = card.reviews ?? [];
  const boughtTogether = resolveByIds(card.boughtTogetherIds, allCards);
  const recommended = resolveByIds(card.recommendedIds, allCards);
  const moreFromCategory = categoryCards.filter((c) => c.id !== card.id);

  return (
    <>
      <PurchaseModal
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1920px] flex-col gap-10 px-4 pb-28 pt-6 sm:gap-12 sm:px-6 sm:pt-10 lg:gap-14 lg:px-10 xl:px-14 2xl:px-16">
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-purple-300"
          >
            <span aria-hidden className="text-lg leading-none">
              ←
            </span>
            Назад к коллекции
          </Link>
        </div>

        <div className="rounded-[1.75rem] border border-white/[0.07] bg-gradient-to-br from-zinc-950/95 via-zinc-950/80 to-violet-950/[0.35] p-5 shadow-[0_0_80px_-24px_rgba(88,28,135,0.45)] sm:p-8 lg:p-10 xl:p-12 2xl:p-14">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start md:gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16 2xl:gap-20">
          <div className="order-1 min-w-0 overflow-visible md:sticky md:top-20 lg:top-24">
            <CardProductGallery card={card} categoryCards={categoryCards} />
          </div>

          <div className="order-2 flex min-w-0 flex-col pt-2 md:max-w-none md:pt-0 xl:pr-4">
            <div className="mb-4 flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${RARITY_BADGE[rarity]}`}
              >
                {RARITY_LABELS[rarity]}
              </span>
              {card.isNew ? (
                <span className="inline-flex items-center rounded-full border border-emerald-400/45 bg-emerald-950/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100">
                  Новинка
                </span>
              ) : null}
              {inStock ? (
                <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-950/50 px-3 py-1 text-xs font-semibold text-emerald-200">
                  В наличии
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-rose-500/40 bg-rose-950/50 px-3 py-1 text-xs font-semibold text-rose-200">
                  Нет в наличии
                </span>
              )}
            </div>

            <h1 className="mb-3 text-3xl font-bold leading-[1.1] text-white sm:text-4xl lg:text-4xl xl:text-5xl 2xl:text-[3.25rem]">
              {card.title}
            </h1>

            <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
              <Link
                href={`/#${collectionSectionId(card.category)}`}
                className="font-medium text-violet-300/95 transition hover:text-violet-200 hover:underline"
              >
                {card.category}
              </Link>
              {card.subcategory?.trim() ? (
                <span className="text-zinc-500">· {card.subcategory.trim()}</span>
              ) : null}
              {card.effect ? (
                <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs uppercase tracking-wide text-zinc-400">
                  {card.effect}
                </span>
              ) : null}
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-3">
              <StarRow value={rating} />
              <span className="text-lg font-semibold tabular-nums text-amber-200">
                {rating.toFixed(1)}
              </span>
              <span className="text-sm text-zinc-500">
                {reviewCount}{" "}
                {reviewCount === 1
                  ? "отзыв"
                  : reviewCount > 1 && reviewCount < 5
                    ? "отзыва"
                    : "отзывов"}
              </span>
            </div>

            <div className="mb-6 flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                Лучшее качество
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200">
                <Truck className="h-4 w-4 shrink-0 text-sky-400" />
                Быстрая доставка
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200">
                <BadgePercent className="h-4 w-4 shrink-0 text-violet-400" />
                Хорошая цена
              </div>
            </div>

            <p className="mb-2 bg-gradient-to-br from-white via-zinc-100 to-zinc-300 bg-clip-text text-4xl font-bold tabular-nums text-transparent sm:text-5xl xl:text-6xl">
              {formatCardPrice(card.price, currency)}
            </p>

            <div className="mb-8 flex w-full max-w-2xl flex-col gap-3 lg:max-w-none lg:flex-row xl:gap-4">
              <button
                type="button"
                disabled={!inStock}
                onClick={() => {
                  const source = document.querySelector("[data-cart-fly-source]");
                  addToCartWithFeedback(card, source as HTMLElement | null);
                }}
                className="w-full rounded-xl border border-purple-500/45 bg-purple-950/40 px-6 py-3.5 text-base font-semibold text-purple-100 transition hover:border-purple-400/55 hover:bg-purple-900/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                В корзину
              </button>
              <button
                type="button"
                disabled={!inStock}
                onClick={() => setPurchaseOpen(true)}
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 py-3.5 text-base font-semibold text-white shadow-[0_0_40px_rgba(168,85,247,0.45)] ring-1 ring-purple-400/40 transition hover:from-purple-500 hover:via-violet-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[200px]"
              >
                Купить
              </button>
            </div>

            <section className="mb-8 rounded-2xl border border-white/[0.06] bg-black/20 p-5 sm:p-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Описание
              </h2>
              <div className="max-w-none text-base leading-relaxed text-zinc-300 lg:text-lg">
                {card.description?.trim() || "Описание появится позже."}
              </div>
            </section>

            {reviews.length > 0 ? (
              <section className="mb-6 border-t border-white/10 pt-8">
                <h2 className="mb-4 text-lg font-bold text-white">Отзывы</h2>
                <ul className="flex flex-col gap-4">
                  {reviews.map((r, i) => (
                    <li
                      key={`${r.author}-${i}`}
                      className="rounded-xl border border-white/8 bg-zinc-950/50 p-4"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white">{r.author}</span>
                        <StarRow value={r.rating} />
                        {r.date ? (
                          <span className="text-xs text-zinc-500">{r.date}</span>
                        ) : null}
                      </div>
                      <p className="text-sm leading-relaxed text-zinc-300">{r.text}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
        </div>

        {moreFromCategory.length > 0 ? (
          <CardMiniRail
            title={`Ещё из категории «${card.category}»`}
            cards={moreFromCategory}
          />
        ) : null}

        <div className="flex flex-col gap-12 border-t border-white/10 pt-6">
          <CardMiniRail title="Вместе с этим покупают" cards={boughtTogether} />
          <CardMiniRail title="Рекомендуем" cards={recommended} />
        </div>
      </div>
    </>
  );
}
