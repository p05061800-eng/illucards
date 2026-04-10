import type { CardRarity } from "../api/cards/route";

export const RARITY_STYLES: Record<CardRarity, string> = {
  common: "text-zinc-400",
  limited: "text-amber-200",
  adult: "text-rose-300",
  novelty: "text-emerald-300",
  hot_price: "text-fuchsia-300",
};

export const RARITY_GLOW: Record<CardRarity, string> = {
  common: "",
  limited: "",
  adult: "",
  novelty: "",
  hot_price: "",
};
