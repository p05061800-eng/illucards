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

/** Обёртка: светящаяся рамка по тегам редкости (лимит / 18+ / оба / горячая цена). */
export function CardRarityGlowShell({
  card,
  frameClassName = "",
  children,
}: Props) {
  const shellClass = catalogCardRarityShellClass(card);
  const frameCls = [catalogCardFrameClass(card), frameClassName]
    .filter(Boolean)
    .join(" ");

  const framed = <div className={frameCls || undefined}>{children}</div>;

  if (!shellClass) {
    return framed;
  }

  return (
    <div className={`${shellClass} rounded-2xl p-[3px]`}>
      <div className="rounded-[0.9375rem] bg-zinc-950">{framed}</div>
    </div>
  );
}
