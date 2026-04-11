"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
 * Переход — `<Link>` + на таче явный `router.push` при коротком тапе: иначе WebKit не шлёт click после micro-move (vario).
 */
/** Порог: если палец сдвинулся меньше — считаем тапом (Safari часто не шлёт click после micro-move для vario). */
const TAP_MAX_PX = 22;

export function HeroCardStack({
  displayCard,
  ultraBgUrl,
}: Props) {
  const router = useRouter();
  const [showStack, setShowStack] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShowStack(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const front = displayCard.frontImage?.trim();
  if (!front) return null;

  const href = `/card/${displayCard.id}`;

  return (
    <div className="grid w-full min-w-0 shrink-0 place-items-center">
      <div className="relative z-0 max-w-full min-w-0 overflow-visible">
        <Link
          href={href}
          className={HERO_CARD_STACK_BUTTON_CLASS}
          aria-label={`Открыть ${displayCard.title}`}
          aria-busy={!showStack}
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
