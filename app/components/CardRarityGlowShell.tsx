import type { ReactNode } from "react";
import type { StoredCard } from "../api/cards/route";
import { catalogCardRarityGlowClass } from "../lib/cardRarityUi";

type Props = {
  card: Pick<StoredCard, "rarity" | "rarities" | "noveltySince" | "frontImage">;
  frameClassName?: string;
  children: ReactNode;
};

/** Обёртка: мягкая подсветка сзади по тегам редкости. */
export function CardRarityGlowShell({
  card,
  frameClassName = "",
  children,
}: Props) {
  const merged = [catalogCardRarityGlowClass(card), frameClassName]
    .filter(Boolean)
    .join(" ");

  return <div className={merged || undefined}>{children}</div>;
}
