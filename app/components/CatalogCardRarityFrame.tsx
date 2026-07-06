import type { ReactNode } from "react";
import type { StoredCard } from "../api/cards/route";
import { catalogCardRarityGlowClass } from "../lib/cardRarityUi";

type Props = {
  card: Pick<StoredCard, "rarity" | "rarities" | "noveltySince" | "frontImage">;
  className?: string;
  children: ReactNode;
};

/** Подсветка сзади превью в каталоге (лимит / 18+ / оба / горячая цена). */
export function CatalogCardRarityFrame({ card, className = "", children }: Props) {
  const merged = [catalogCardRarityGlowClass(card), className]
    .filter(Boolean)
    .join(" ");

  return <div className={merged || undefined}>{children}</div>;
}
