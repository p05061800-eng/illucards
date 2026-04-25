"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type TouchEvent,
} from "react";
import type { StoredCard } from "../../api/cards/route";
import { ultraOrHeroBgUrl } from "../../lib/cardUltraBg";
import { CardStackVisual } from "@/components/hero/CardStackVisual";

type Props = {
  activeCard: StoredCard;
  /** Порядок и набор карточек для стрелок и свайпа (категория или каталог). */
  browseCards: StoredCard[];
  onNavigate?: (nextId: string) => void;
  /** Крупнее превью на странице товара. */
  layout?: "default" | "product";
  /** Только центральная колонка со стопкой (стрелки снаружи, напр. герой). */
  hideNavigation?: boolean;
  /** Для `layout="product"`: ограничение ширины центра как на странице товара. */
  productCenterConstrained?: boolean;
  onCardClick?: (cardId: string) => void;
};

/** Корневая оболочка стопки на странице товара — та же разметка в герое при `productPageLike`. */
export const PRODUCT_PAGE_STACK_ROOT_CLASS =
  "product-card-page-stack relative mx-auto w-full max-w-full overflow-visible rounded-xl px-1 pb-10 pt-4 sm:px-2 sm:pb-12 sm:pt-5 md:pb-14 md:pt-6";

/** Кнопки листания карточки на странице товара — те же классы можно использовать в герое. */
export const PRODUCT_CARD_NAV_ARROW_CLASS =
  "relative z-20 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-zinc-950/90 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-purple-400/50 hover:bg-purple-950/55 hover:shadow-[0_0_24px_rgba(168,85,247,0.45),0_0_40px_rgba(139,92,246,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 md:h-11 md:w-11";

const arrowClassName = PRODUCT_CARD_NAV_ARROW_CLASS;

export function ProductCardNavArrowIcon({
  direction,
}: {
  direction: "prev" | "next";
}) {
  return (
    <svg
      className="h-4 w-4 md:h-[1.125rem] md:w-[1.125rem]"
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
  );
}

function ArrowControl({
  direction,
  disabled,
  href,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  href?: string;
  onClick: () => void;
}) {
  const label =
    direction === "prev" ? "Предыдущая карточка" : "Следующая карточка";
  if (disabled) {
    return (
      <span
        className={`${arrowClassName} pointer-events-none cursor-not-allowed opacity-35`}
        aria-hidden
      >
        <ProductCardNavArrowIcon direction={direction} />
      </span>
    );
  }
  if (href) {
    return (
      <Link
        href={href}
        prefetch
        scroll
        aria-label={label}
        className={arrowClassName}
      >
        <ProductCardNavArrowIcon direction={direction} />
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={arrowClassName}
    >
      <ProductCardNavArrowIcon direction={direction} />
    </button>
  );
}

const SWIPE_PX = 56;

/** Стопка карточки; стрелки листают по списку `browseCards` (на товаре — обычно весь каталог). */
export function CardViewer({
  activeCard,
  browseCards,
  onNavigate,
  layout = "default",
  hideNavigation = false,
  productCenterConstrained = true,
  onCardClick,
}: Props) {
  const router = useRouter();
  const touchStartX = useRef<number | null>(null);
  const n = browseCards.length;
  const rawIdx = browseCards.findIndex((c) => c.id === activeCard.id);
  const idx = rawIdx >= 0 ? rawIdx : 0;
  const active = browseCards[idx] ?? browseCards[0];
  const clickable = Boolean(onCardClick);

  const handleCardClick = useCallback(() => {
    if (!active || !clickable) return;
    onCardClick?.(active.id);
  }, [active, clickable, onCardClick]);

  const onCardKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!clickable) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleCardClick();
      }
    },
    [clickable, handleCardClick]
  );

  const go = useCallback(
    (delta: -1 | 1) => {
      if (n <= 1) return;
      const ni = (idx + delta + n) % n;
      const nextId = browseCards[ni]!.id;
      if (onNavigate) {
        onNavigate(nextId);
      } else {
        router.push(`/card/${nextId}`);
      }
    },
    [n, idx, browseCards, onNavigate, router]
  );

  const prevHref =
    !onNavigate && n > 1
      ? `/card/${browseCards[(idx - 1 + n) % n]!.id}`
      : undefined;
  const nextHref =
    !onNavigate && n > 1
      ? `/card/${browseCards[(idx + 1) % n]!.id}`
      : undefined;

  useEffect(() => {
    if (n <= 1) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }
      e.preventDefault();
      go(e.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [n, go]);

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

  /** Превью товара: высота от изображения; padding даёт запас под 3D-наклон/тени. */
  const productRoot = PRODUCT_PAGE_STACK_ROOT_CLASS;
  const defaultRoot =
    "relative mx-auto w-full max-w-[min(100%,calc(100%-4rem))] overflow-visible rounded-2xl";

  const wrapMax =
    layout === "product"
      ? productCenterConstrained
        ? "max-w-[min(100%,min(96vw,1600px))]"
        : "max-w-none"
      : "max-w-[min(100%,min(96vw,720px))]";

  const centerColumn = (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      className={`relative z-0 flex min-h-0 min-w-0 touch-pan-y justify-center overflow-visible px-0.5 ${hideNavigation ? "w-full flex-none" : `flex-1 ${wrapMax}`} ${clickable ? "cursor-pointer" : ""}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={clickable ? handleCardClick : undefined}
      onKeyDown={clickable ? onCardKeyDown : undefined}
    >
      <div className="grid w-full min-w-0 min-h-0 place-items-start justify-items-center overflow-visible py-1">
        <div
          className={`relative z-0 flex w-full min-h-0 justify-center overflow-visible ${layout === "product" ? "max-w-full px-2 pb-2 pt-0 sm:px-4 sm:pb-4" : "max-w-full"}`}
        >
          <CardStackVisual
            key={active.id}
            card={active}
            ultraBgUrl={ultraOrHeroBgUrl(active)}
            heroStack={layout !== "product"}
            heroDiagonalLayout={layout === "product"}
            dataCartFlySource
            rootClassName={layout === "product" ? productRoot : defaultRoot}
          />
        </div>
      </div>
    </div>
  );

  if (hideNavigation) {
    return centerColumn;
  }

  return (
    <div className="flex w-full max-w-full items-center justify-center gap-1.5 overflow-visible sm:gap-2 md:gap-3">
      <ArrowControl
        direction="prev"
        disabled={n <= 1}
        href={prevHref}
        onClick={() => go(-1)}
      />

      {centerColumn}

      <ArrowControl
        direction="next"
        disabled={n <= 1}
        href={nextHref}
        onClick={() => go(1)}
      />
    </div>
  );
}
