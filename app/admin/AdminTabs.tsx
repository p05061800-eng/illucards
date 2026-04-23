"use client";

import { useCallback, useState } from "react";
import { useCategoryFramesRefresh } from "../context/CategoryFramesContext";
import type { StoredCard } from "../api/cards/route";
import { AdminCardForm } from "./AdminCardForm";
import { AdminCardsTable } from "./AdminCardsTable";
import { AdminCategoriesEditor } from "./AdminCategoriesEditor";
import { apiUrl } from "../lib/apiUrl";

const TABS = [
  { id: "cards", label: "Карточки" },
  { id: "categories", label: "Категории" },
  { id: "orders", label: "Заказы" },
  { id: "reviews", label: "Отзывы" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function SectionPlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 px-6 py-16 text-center backdrop-blur-sm">
      <p className="font-medium text-zinc-400">{title}</p>
      <p className="mt-2 text-sm text-zinc-600">
        Раздел скоро будет доступен.
      </p>
    </div>
  );
}

type AdminTabsProps = {
  initialCards: StoredCard[];
};

export function AdminTabs({ initialCards }: AdminTabsProps) {
  const refreshCategoryFrames = useCategoryFramesRefresh();
  const [active, setActive] = useState<TabId>("cards");
  const [cards, setCards] = useState<StoredCard[]>(initialCards);
  const [editingCard, setEditingCard] = useState<StoredCard | null>(null);

  const setTab = useCallback(
    (id: TabId) => {
      setActive(id);
      if (id === "cards") refreshCategoryFrames();
    },
    [refreshCategoryFrames],
  );

  const refreshCards = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/cards"));
      if (!res.ok) return;
      const data = (await res.json()) as unknown;
      if (Array.isArray(data)) {
        setCards(data as StoredCard[]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const deleteCard = useCallback(async (id: string) => {
    if (!window.confirm("Удалить эту карточку из каталога?")) return;
    try {
      const res = await fetch(
        apiUrl(`/api/cards?id=${encodeURIComponent(id)}`),
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        window.alert(err?.error ?? "Не удалось удалить карточку.");
        return;
      }
      setCards((prev) => prev.filter((c) => c.id !== id));
    } catch {
      window.alert("Не удалось удалить карточку.");
    }
  }, []);

  return (
    <>
      <nav
        className="mb-8 flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-zinc-950/95 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
        aria-label="Разделы админки"
      >
        {TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-xl px-3 py-2.5 text-left text-sm font-medium transition sm:px-4 ${
                isActive
                  ? "bg-purple-600 text-white shadow-[0_0_22px_rgba(168,85,247,0.45)] ring-1 ring-purple-400/35"
                  : "text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-100"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {active === "cards" ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-purple-500/20 bg-zinc-950/40 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-5">
            <h2 className="mb-3 text-sm font-semibold tracking-tight text-zinc-200">
              {editingCard ? "Редактировать карточку" : "Добавить карточку"}
            </h2>
            <AdminCardForm
              key={editingCard?.id ?? "new"}
              allCards={cards}
              editingCard={editingCard}
              onCancelEdit={() => setEditingCard(null)}
              onSuccess={() => {
                void refreshCards();
                window.setTimeout(() => setEditingCard(null), 600);
              }}
            />
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold tracking-tight text-zinc-300">
              Каталог по категориям
            </h2>
            <AdminCardsTable
              cards={cards}
              deleteCard={deleteCard}
              onEdit={setEditingCard}
            />
          </div>
        </div>
      ) : null}
      {active === "categories" ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-6 backdrop-blur-sm">
          <AdminCategoriesEditor variant="embedded" />
        </div>
      ) : null}
      {active === "orders" ? <SectionPlaceholder title="Заказы" /> : null}
      {active === "reviews" ? <SectionPlaceholder title="Отзывы" /> : null}
    </>
  );
}
