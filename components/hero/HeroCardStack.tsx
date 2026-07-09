"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { StoredCard } from "@/app/api/cards/route";
import { useAdultContentGateOptional } from "@/app/context/AdultContentContext";
import { cardRequiresAgeConfirmation } from "@/app/lib/cardRequiresAgeConfirmation";
import { useCardLinkTouchNav } from "@/app/lib/useCardLinkTouchNav";
import { isAdultAgeGateTarget } from "@/app/components/AdultContentBlurGate";
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
  noveltyNarrow?: boolean;
  catalogStackMatch?: boolean;
  productPageLike?: boolean;
};

export function HeroCardStack({
  displayCard,
  ultraBgUrl,
  noveltyNarrow = false,
  catalogStackMatch = false,
  productPageLike = false,
}: Props) {
  const router = useRouter();
  const adultGate = useAdultContentGateOptional();
  const adultLocked =
    cardRequiresAgeConfirmation(displayCard) &&
    !(adultGate?.isAdultConfirmed(displayCard.id) ?? false);

  const href = `/card/${displayCard.id}`;

  const openCardNav = useCallback(() => {
    if (adultLocked) return;
    router.push(href);
  }, [adultLocked, href, router]);

  const cardTouchNav = useCardLinkTouchNav(openCardNav, {
    shouldIgnoreTarget: isAdultAgeGateTarget,
  });

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

  const buttonClass = productPageLike
    ? HERO_CARD_STACK_BUTTON_CLASS_PRODUCT_LIKE
    : noveltyNarrow
      ? HERO_CARD_STACK_BUTTON_CLASS_NOVELTY_NARROW
      : HERO_CARD_STACK_BUTTON_CLASS;

  const stack = productPageLike ? (
    <CardStackVisual
      card={cardForVisual}
      ultraBgUrl={ultraBgUrl}
      heroDiagonalLayout
      navigationTapSafe
      dataCartFlySource
      rootClassName={PRODUCT_PAGE_STACK_ROOT_CLASS}
    />
  ) : catalogStackMatch ? (
    <CardStackVisual
      card={cardForVisual}
      ultraBgUrl={ultraBgUrl}
      catalogStack
      navigationTapSafe
      dataCartFlySource
      rootClassName="relative mx-auto max-w-full rounded-2xl"
    />
  ) : (
    <CardStackVisual
      card={cardForVisual}
      ultraBgUrl={ultraBgUrl}
      heroStack
      catalogLikeDiagonal
      navigationTapSafe
      dataCartFlySource
      rootClassName={heroRootClass}
    />
  );

  return (
    <div className={`flex w-full min-w-0 shrink-0 justify-center`}>
      <div className="relative z-0 flex w-full min-w-0 max-w-full justify-center overflow-visible">
        {adultLocked ? (
          <div
            className={buttonClass}
            aria-label={`${displayCard.title} — подтвердите возраст 18+ на карточке`}
          >
            {stack}
          </div>
        ) : (
          <Link
            href={href}
            className={buttonClass}
            aria-label={`Открыть ${displayCard.title}`}
            suppressHydrationWarning
            onClick={(e) => {
              if (cardTouchNav.consumeTouchNavigationClick()) {
                e.preventDefault();
              }
            }}
            onTouchStartCapture={cardTouchNav.onTouchStartCapture}
            onTouchMoveCapture={cardTouchNav.onTouchMoveCapture}
            onTouchEnd={cardTouchNav.onTouchEnd}
            onTouchCancel={cardTouchNav.onTouchCancel}
          >
            {stack}
          </Link>
        )}
      </div>
    </div>
  );
}
