"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StoredCard } from "@/app/api/cards/route";
import { CUSTOM_ORDER_CATEGORY_NAME } from "@/app/lib/categoriesJson";
import { buildCustomOrderHeroCards } from "@/app/lib/customOrderHeroCarousel";
import { adminFetch } from "@/app/lib/adminFetch";
import { AdminCardForm } from "./AdminCardForm";

export function AdminCustomOrderCardsEditor() {
  const [allCards, setAllCards] = useState<StoredCard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editingCard, setEditingCard] = useState<StoredCard | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await adminFetch("/api/cards");
      if (!res.ok) return;
      const data = (await res.json()) as unknown;
      if (Array.isArray(data)) setAllCards(data as StoredCard[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoaded(true));
  }, [refresh]);

  const orderCards = useMemo(
    () => buildCustomOrderHeroCards(allCards),
    [allCards],
  );

  const deleteCard = useCallback(async (id: string) => {
    if (!window.confirm("Удалить эту карточку с главной?")) return;
    try {
      const res = await adminFetch(`/api/cards?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        window.alert(err?.error ?? "Не удалось удалить.");
        return;
      }
      setAllCards((prev) => prev.filter((c) => c.id !== id));
      setEditingCard((cur) => (cur?.id === id ? null : cur));
    } catch {
      window.alert("Не удалось удалить.");
    }
  }, []);

  if (!loaded) {
    return <p className="text-sm text-zinc-500">Загрузка карточек…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-white">
          Карточки на главной
        </h3>
        <p className="mt-1 text-sm text-zinc-400">
          Добавляются так же, как в каталоге: две стороны и эффект Vario.
          Сейчас: {orderCards.length}.
        </p>
      </div>

      {orderCards.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {orderCards.map((card) => (
            <li
              key={card.id}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.frontImage}
                alt=""
                className="h-16 w-11 shrink-0 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">
                  {card.title || "Без названия"}
                </p>
                <p className="text-xs text-zinc-500">Vario</p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg border border-white/15 px-2 py-1 text-xs text-amber-200 hover:border-amber-400/40"
                onClick={() => setEditingCard(card)}
              >
                Изменить
              </button>
              <button
                type="button"
                className="shrink-0 rounded-lg border border-white/15 px-2 py-1 text-xs text-red-300 hover:border-red-400/40"
                onClick={() => void deleteCard(card.id)}
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">
          Пока нет карточек. Заполните форму ниже — они появятся на главной со
          стрелками.
        </p>
      )}

      <div className="rounded-xl border border-purple-500/20 bg-zinc-950/40 p-4 sm:p-5">
        <h4 className="mb-3 text-sm font-semibold text-zinc-200">
          {editingCard
            ? "Редактировать карточку на заказ"
            : "Добавить карточку на заказ"}
        </h4>
        <AdminCardForm
          key={editingCard?.id ?? "new-custom-order"}
          allCards={allCards}
          editingCard={editingCard}
          forcedCategory={CUSTOM_ORDER_CATEGORY_NAME}
          forcedEffect="vario"
          onCancelEdit={() => setEditingCard(null)}
          onSuccess={() => {
            setEditingCard(null);
            void refresh();
          }}
        />
      </div>
    </div>
  );
}
