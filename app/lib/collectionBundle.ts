import type { StoredCard } from "@/app/api/cards/route";
import { isCustomOrderCategory } from "@/app/lib/customOrderHeroCarousel";
import {
  effectiveCardPriceByn,
  effectiveCardPriceRub,
} from "@/app/lib/formatPrice";
import { resolveTmntCollectionId } from "@/app/lib/tmntCollections";

/** Человек-паук — Marvel. TMNT «Последний урок» — отдельная скидка. */
const SALE_BY_KEY: Record<string, { byn: number; rub: number }> = {
  marvel: { byn: 1650, rub: 45_000 },
  "tmnt-turtles": { byn: 770, rub: 21_000 },
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
  if (n.includes("последний урок") || n === "turtles") return "tmnt-turtles";
  if (n.includes("наследие хамато") || n === "foes") return "tmnt-foes";
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

function addMoney(
  a: { byn: number; rub: number },
  b: { byn: number; rub: number },
): { byn: number; rub: number } {
  return {
    byn: Math.round((a.byn + b.byn) * 100) / 100,
    rub: Math.round(a.rub + b.rub),
  };
}

export function collectionOfferPrice(
  collectionName: string,
  cards: readonly StoredCard[],
): {
  byn: number;
  rub: number;
  discounted: boolean;
  retail: { byn: number; rub: number };
} {
  const pack = collectionPackCards(cards);
  const retail = collectionRetailTotal(pack);
  const key = collectionBundleKey(collectionName);

  if (key === "tmnt") {
    const turtles = pack.filter(
      (c) => resolveTmntCollectionId(c.subcategory) === "turtles",
    );
    const foes = pack.filter(
      (c) => resolveTmntCollectionId(c.subcategory) === "foes",
    );
    const turtlesSale = SALE_BY_KEY["tmnt-turtles"];
    const turtlesPart =
      turtles.length > 0 && turtlesSale
        ? turtlesSale
        : collectionRetailTotal(turtles);
    const foesPart = collectionRetailTotal(foes);
    const offer = addMoney(turtlesPart, foesPart);
    return {
      byn: offer.byn,
      rub: offer.rub,
      discounted: turtles.length > 0 && Boolean(turtlesSale),
      retail,
    };
  }

  const sale = SALE_BY_KEY[key];
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
