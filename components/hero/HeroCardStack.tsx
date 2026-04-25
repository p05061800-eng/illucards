"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef } from "react";
import type { StoredCard } from "@/app/api/cards/route";
import { useAdultContentGateOptional } from "@/app/context/AdultContentContext";
import { cardRequiresAgeConfirmation } from "@/app/lib/cardRequiresAgeConfirmation";
import { PRODUCT_PAGE_STACK_ROOT_CLASS } from "@/app/components/card-showcase/CardViewer";
import { CardStackVisual } from "./CardStackVisual";
import {
  HERO_CARD_STACK_BUTTON_CLASS,
  HERO_CARD_STACK_BUTTON_CLASS_NOVELTY_NARROW,
  heroCardStackRootClass,
} from "./heroCardStackClasses";

const HERO_CARD_STACK_BUTTON_CLASS_PRODUCT_LIKE =
  "group/cardstack relative block w-full min-w-0 shrink-0 cursor-pointer overflow-visible border-0 bg-transparent p-0 text-left";

type Props = {
  displayCard: StoredCard;
  ultraBgUrl: string;
  /** Чуть уже карточка в колонке «Новинки» рядом с заголовком. */
  noveltyNarrow?: boolean;
  /**
   * Та же отрисовка стопки, что в каталоге (`CardItem`): `catalogStack`, рамка и наклон слоя 3.
   * Для героя «Новинки» — вместе с `noveltyNarrow`.
   */
  catalogStackMatch?: boolean;
  /** Как на странице товара: крупнее, `heroDiagonalLayout`, без max-width на обёртке. */
  productPageLike?: boolean;
};

/** Обычный герой: `<Link>` + на таче явный `router.push` при коротком тапе (vario/WebKit). */
const TAP_MAX_PX = 22;

export function HeroCardStack({
  displayCard,
  ultraBgUrl,
  noveltyNarrow = false,
  catalogStackMatch = false,
  productPageLike = false,
}: Props) {
  const router = useRouter();
  const adultGate = useAdultContentGateOptional();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const adultLocked =
    cardRequiresAgeConfirmation(displayCard) &&
    !(adultGate?.isAdultConfirmed(displayCard.id) ?? false);

  const cardForVisual = useMemo((): StoredCard => {
    if (displayCard.frontImage?.trim()) return displayCard;
    const fb = (
      displayCard.categoryBg?.trim() ||
      ultraBgUrl?.trim() ||
      ""
    ).trim();
    if (!fb) return displayCard;
    return { ...displayCard, frontImage: fb };
  }, [displayCard, ultraBgUrl]);

  const front = cardForVisual.frontImage?.trim();
  if (!front) return null;

  const heroRootClass = heroCardStackRootClass();

  const href = `/card/${displayCard.id}`;
  const buttonClass = productPageLike
    ? HERO_CARD_STACK_BUTTON_CLASS_PRODUCT_LIKE
    : noveltyNarrow
      ? HERO_CARD_STACK_BUTTON_CLASS_NOVELTY_NARROW
      : HERO_CARD_STACK_BUTTON_CLASS;

  const rowJustify = "justify-center";

  const stack = productPageLike ? (
    <CardStackVisual
      card={cardForVisual}
      ultraBgUrl={ultraBgUrl}
      heroDiagonalLayout
      dataCartFlySource
      rootClassName={PRODUCT_PAGE_STACK_ROOT_CLASS}
    />
  ) : catalogStackMatch ? (
    <CardStackVisual
      card={cardForVisual}
      ultraBgUrl={ultraBgUrl}
      catalogStack
      dataCartFlySource
      rootClassName="relative mx-auto max-w-full rounded-2xl"
    />
  ) : (
    <CardStackVisual
      card={cardForVisual}
      ultraBgUrl={ultraBgUrl}
      heroStack
      catalogLikeDiagonal
      dataCartFlySource
      rootClassName={heroRootClass}
    />
  );

  return (
    <div className={`flex w-full min-w-0 shrink-0 ${rowJustify}`}>
      <div
        className="relative z-0 flex w-full min-w-0 max-w-full justify-center overflow-visible"
      >
        <Link
          href={href}
          className={`${buttonClass}${adultLocked ? " pointer-events-none" : ""}`}
          aria-label={`Открыть ${displayCard.title}`}
          suppressHydrationWarning
          onTouchStartCapture={(e) => {
            if (e.touches.length === 0) return;
            const t = e.touches[0];
            touchStartRef.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            const start = touchStartRef.current;
            touchStartRef.current = null;
            if (!start || e.changedTouches.length === 0) return;
            const t = e.changedTouches[0];
            const dx = Math.abs(t.clientX - start.x);
            const dy = Math.abs(t.clientY - start.y);
            if (dx <= TAP_MAX_PX && dy <= TAP_MAX_PX) {
              e.preventDefault();
              router.push(href);
            }
          }}
          onTouchCancel={() => {
            touchStartRef.current = null;
          }}
        >
          {stack}
        </Link>
      </div>
    </div>
  );
}
