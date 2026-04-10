"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { StoredCard } from "@/app/api/cards/route";
import { focusToStyle } from "@/app/lib/imageFocus";
import { CardStackVisual } from "./CardStackVisual";
import {
  HERO_CARD_STACK_BUTTON_CLASS,
  HERO_CARD_STACK_ROOT_CLASS,
} from "./heroCardStackClasses";

type Props = {
  displayCard: StoredCard;
  ultraBgUrl: string;
};

/**
 * Герой: тяжёлый CardStackVisual монтируем только после гидратации — иначе в Safari/Next
 * часто ломается гидратация (className/DOM), и картинка пропадает после обновления страницы.
 * Переход на карточку — через `<Link>`, не через `<button>` вокруг слоя с pointer capture (иначе клики ломаются в Safari/Telegram WebView).
 */
export function HeroCardStack({
  displayCard,
  ultraBgUrl,
}: Props) {
  const [showStack, setShowStack] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShowStack(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const front = displayCard.frontImage?.trim();
  if (!front) return null;

  const href = `/card/${displayCard.id}`;

  return (
    <div className="grid w-full min-w-0 shrink-0 place-items-center">
      <div className="relative z-0 max-w-full overflow-visible">
        <Link
          href={href}
          className={HERO_CARD_STACK_BUTTON_CLASS}
          aria-label={`Открыть ${displayCard.title}`}
          aria-busy={!showStack}
          suppressHydrationWarning
        >
          {showStack ? (
            <CardStackVisual
              card={displayCard}
              ultraBgUrl={ultraBgUrl}
              heroStack
              dataCartFlySource
              rootClassName={HERO_CARD_STACK_ROOT_CLASS}
            />
          ) : (
            <div
              className={`${HERO_CARD_STACK_ROOT_CLASS} relative overflow-hidden bg-zinc-900/60 ring-1 ring-white/10`}
              aria-hidden
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={front}
                alt=""
                className="h-full w-full object-cover opacity-50"
                style={focusToStyle(displayCard.frontImageFocus)}
                draggable={false}
                decoding="async"
              />
            </div>
          )}
        </Link>
      </div>
    </div>
  );
}
