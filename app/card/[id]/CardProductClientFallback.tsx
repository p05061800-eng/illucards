"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { StoredCard } from "@/app/api/cards/route";
import { apiUrl } from "@/app/lib/apiUrl";
import { sortSectionCardsForDefaultCatalog } from "@/app/lib/collectionFilter";
import { readProductPreview } from "@/app/lib/productCardPreview";
import { resolveTmntCollections } from "@/app/lib/tmntCollections";
import CardProductContent from "./CardProductContent";

export function CardProductClientFallback({ id }: { id: string }) {
  const [card, setCard] = useState<StoredCard | null>(null);
  const [all, setAll] = useState<StoredCard[]>([]);
  const [missing, setMissing] = useState(false);

  useLayoutEffect(() => {
    const preview = readProductPreview(id);
    if (!preview) return;
    setCard(preview);
    setAll([preview]);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/cards"))
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: unknown) => {
        if (cancelled || !Array.isArray(data)) return;
        const cards = data as StoredCard[];
        const found = cards.find((c) => c.id === id) ?? null;
        if (!found) {
          setMissing(true);
          return;
        }
        setCard(found);
        setAll(cards);
      })
      .catch(() => {
        if (!cancelled && !readProductPreview(id)) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const view = useMemo(() => {
    if (!card) return null;
    const cat = card.category?.trim() ?? "";
    const categoryCards =
      cat.length > 0
        ? all.filter((c) => (c.category?.trim() ?? "") === cat)
        : [card];
    const categoryNames = [
      ...new Set(
        all.map((c) => c.category?.trim() ?? "").filter((n) => n.length > 0),
      ),
    ].sort((a, b) => a.localeCompare(b, "ru"));
    const firstCardIdByCategory: Record<string, string> = {};
    for (const name of categoryNames) {
      const inCat = all.filter((c) => (c.category?.trim() ?? "") === name);
      const first = sortSectionCardsForDefaultCatalog(inCat, all)[0];
      if (first) firstCardIdByCategory[name] = first.id;
    }
    return {
      categoryCards: categoryCards.length > 0 ? categoryCards : [card],
      categoryNames,
      firstCardIdByCategory,
    };
  }, [all, card]);

  if (missing && !card) {
    return (
      <main className="main relative min-h-[50vh] bg-black px-4 py-16 text-center text-sm text-zinc-400">
        Карточка не найдена.
      </main>
    );
  }

  if (!card || !view) {
    return <main className="main relative min-h-[50vh] bg-black" />;
  }

  return (
    <main className="main relative overflow-x-hidden text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-black"
        aria-hidden
      />
      <CardProductContent
        card={card}
        categoryCards={view.categoryCards}
        categoryNames={view.categoryNames}
        firstCardIdByCategory={view.firstCardIdByCategory}
        tmntCollections={resolveTmntCollections()}
      />
    </main>
  );
}
