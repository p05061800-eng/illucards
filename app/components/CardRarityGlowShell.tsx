import type { ReactNode } from "react";
import type { StoredCard } from "../api/cards/route";
import {
  catalogCardFrameClass,
  catalogCardRarityShellClass,
} from "../lib/cardRarityUi";

type Props = {
  card: Pick<StoredCard, "rarity" | "rarities" | "noveltySince" | "frontImage">;
  frameClassName?: string;
  children: ReactNode;
};

/** Обёртка: светящаяся рамка по тегам редкости — glow снаружи, размер карты не меняется. */
export function CardRarityGlowShell({
  card,
  frameClassName = "",
  children,
}: Props) {
  const merged = [
    catalogCardRarityShellClass(card),
    catalogCardFrameClass(card),
    frameClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={merged || undefined}>{children}</div>;
}
