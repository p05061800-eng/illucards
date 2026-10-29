import type { StoredCard } from "@/app/api/cards/route";
import { isCustomOrderCategory } from "@/app/lib/customOrderHeroCarousel";
import {
  effectiveCardPriceByn,
  effectiveCardPriceRub,
} from "@/app/lib/formatPrice";

/** Человек-паук на витрине — коллекция Marvel (legacy category spider-man). */
const SALE_BY_KEY: Record<string, { byn: number; rub: number }> = {
  marvel: { byn: 1650, rub: 45_000 },
  tmnt: { byn: 770, rub: 21_000 },
};

export function collectionBundleKey(name: string): string {
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (
    n === "marvel" ||
    n === "spider-man" ||
    n === "spider man" ||
    n.includes("паук")
  ) {
    return "marvel";
  }
  if (n === "tmnt") return "tmnt";
  return n;
}

export function collectionPackLineId(name: string): string {
  return `collection-pack:${collectionBundleKey(name)}`.slice(0, 120);
}

export function collectionPackCards(cards: readonly StoredCard[]): StoredCard[] {
  const seen = new Set<string>();
  const out: StoredCard[] = [];
  for (const card of cards) {
    const id = String(card?.id || "").trim();
    if (!id || isCustomOrderCategory(card.category) || seen.has(id)) continue;
    seen.add(id);
    out.push(card);
  }
  return out;
}

export function collectionRetailTotal(cards: readonly StoredCard[]): {
  byn: number;
  rub: number;
} {
  let byn = 0;
  let rub = 0;
  for (const card of cards) {
    byn += effectiveCardPriceByn(card);
    rub += effectiveCardPriceRub(card);
  }
  return {
    byn: Math.round(byn * 100) / 100,
    rub: Math.round(rub),
  };
}

export function collectionOfferPrice(
  collectionName: string,
  retail: { byn: number; rub: number },
): {
  byn: number;
  rub: number;
  discounted: boolean;
  retail: { byn: number; rub: number };
} {
  const sale = SALE_BY_KEY[collectionBundleKey(collectionName)];
  if (sale) {
    return { byn: sale.byn, rub: sale.rub, discounted: true, retail };
  }
  return {
    byn: retail.byn,
    rub: retail.rub,
    discounted: false,
    retail,
  };
}
