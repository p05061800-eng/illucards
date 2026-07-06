import type { ReactNode } from "react";
import type { StoredCard } from "../api/cards/route";
import {
  catalogCardFrameClass,
  catalogCardRarityShellClass,
} from "../lib/cardRarityUi";

type Props = {
  card: Pick<StoredCard, "rarity" | "rarities" | "noveltySince" | "frontImage">;
  className?: string;
  children: ReactNode;
};

/** Рамка превью в каталоге: золото / красное / оба / горячая цена — без сжатия карточки. */
export function CatalogCardRarityFrame({ card, className = "", children }: Props) {
  const merged = [
    catalogCardRarityShellClass(card),
    catalogCardFrameClass(card),
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={merged || undefined}>{children}</div>;
}
