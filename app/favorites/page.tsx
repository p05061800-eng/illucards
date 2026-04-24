"use client";

import { useEffect, useState } from "react";
import type { StoredCard } from "../api/cards/route";
import { CardItem } from "../components/CardItem";
import { useFavorites } from "../context/FavoritesContext";
import { apiUrl } from "../lib/apiUrl";

export default function FavoritesPage() {
  const { favoriteIds, hydrated } = useFavorites();
  const [cards, setCards] = useState<StoredCard[]>([]);

  useEffect(() => {
    fetch(apiUrl("/api/cards"))
      .then((r) => r.json())
      .then((data: unknown) =>
        setCards(Array.isArray(data) ? (data as StoredCard[]) : [])
      )
      .catch(() => setCards([]));
  }, []);

  const list = cards.filter((c) => favoriteIds.includes(c.id));

  return (
    <main className="main relative overflow-x-hidden bg-black px-4 pb-16 pt-8 text-white sm:px-6">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_-15%,rgba(88,28,135,0.18),transparent_55%)]"
        aria-hidden
      />
      <div className="relative z-10 mx-auto w-full min-w-0 max-w-[min(100%,1800px)]">
        <h1 className="mb-2 text-2xl font-bold text-white sm:text-3xl">
          Избранное
        </h1>
        <p className="mb-8 text-sm text-zinc-500">
          Карточки, которые вы отметили ❤️
        </p>

        {!hydrated ? (
          <p className="text-zinc-500">Загрузка…</p>
        ) : list.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-zinc-950/60 px-6 py-12 text-center text-zinc-400">
            Пока пусто
          </p>
        ) : (
          <ul className="collection-card-grid list-none min-w-0">
            {list.map((card) => (
              <li key={card.id} className="flex h-full min-h-0 min-w-0">
                <CardItem card={card} hideUltraLayer />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
