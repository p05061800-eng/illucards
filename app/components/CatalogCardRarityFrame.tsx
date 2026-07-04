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

/** Рамка превью в каталоге: золото / красное / оба / горячая цена. */
export function CatalogCardRarityFrame({ card, className = "", children }: Props) {
  const shellClass = catalogCardRarityShellClass(card);
  const frameClass = catalogCardFrameClass(card);
  const merged = [frameClass, className].filter(Boolean).join(" ");

  if (!shellClass) {
    return <div className={merged || undefined}>{children}</div>;
  }

  const shellRadius = className.includes("rounded-t")
    ? "rounded-t-2xl"
    : "rounded-2xl";
  const innerRadius = className.includes("rounded-t")
    ? "rounded-t-[0.9375rem]"
    : "rounded-[0.9375rem]";

  return (
    <div className={`${shellClass} ${shellRadius} p-[3px]`}>
      <div className={`${innerRadius} bg-zinc-950`}>
        <div className={merged || undefined}>{children}</div>
      </div>
    </div>
  );
}
