import type { ReactNode } from "react";
import type { CardRarity } from "../api/cards/route";
import { RARITY_GLOW } from "../lib/cardRarityUi";

type Props = {
  rarity: CardRarity;
  frameClassName: string;
  children: ReactNode;
};

/** Обёртка: glow по редкости + опциональная градиентная рамка для «Горячая цена». */
export function CardRarityGlowShell({
  rarity,
  frameClassName,
  children,
}: Props) {
  const framed = <div className={frameClassName}>{children}</div>;
  const withGlow = (
    <div className={`rounded-2xl p-2 ${RARITY_GLOW[rarity]}`}>{framed}</div>
  );
  if (rarity !== "hot_price") {
    return withGlow;
  }
  return (
    <div className="rounded-2xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500 p-[2px]">
      <div className="rounded-[0.9375rem] bg-zinc-950">{withGlow}</div>
    </div>
  );
}
