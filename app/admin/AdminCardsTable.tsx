"use client";

import Image from "next/image";
import Link from "next/link";
import type { StoredCard } from "../api/cards/route";
import { formatCardPrice } from "../lib/formatPrice";
import { categoryLabel } from "../lib/categoryLabels";

type Props = {
  cards: StoredCard[];
  deleteCard: (id: string) => void | Promise<void>;
  onEdit?: (card: StoredCard) => void;
};

export function AdminCardsTable({ cards, deleteCard, onEdit }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-black/50">
              <th
                scope="col"
                className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-5"
              >
                Изображение
              </th>
              <th
                scope="col"
                className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-5"
              >
                Название
              </th>
              <th
                scope="col"
                className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-5"
              >
                Категория
              </th>
              <th
                scope="col"
                className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-5"
              >
                Цена
              </th>
              <th
                scope="col"
                className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-5"
              >
                Статус
              </th>
              <th
                scope="col"
                className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-5"
              >
                Действия
              </th>
            </tr>
          </thead>
          <tbody>
            {cards.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-14 text-center text-zinc-500"
                >
                  Пока нет карточек. Добавьте первую ниже.
                </td>
              </tr>
            ) : (
              cards.map((card) => (
                <tr
                  key={card.id}
                  className="border-b border-white/[0.06] transition-colors last:border-b-0 hover:bg-purple-950/25"
                >
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <div className="relative aspect-[3/4] w-11 shrink-0 overflow-hidden rounded-2xl bg-zinc-800 ring-1 ring-white/10">
                      {card.frontImage ? (
                        <Image
                          src={card.frontImage}
                          alt=""
                          fill
                          className="rounded-2xl object-cover"
                          sizes="44px"
                        />
                      ) : (
                        <div
                          className="flex h-full items-center justify-center text-[10px] text-zinc-600"
                          aria-hidden
                        >
                          —
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="max-w-[200px] px-4 py-3 align-middle font-medium text-zinc-100 sm:px-5">
                    <span className="line-clamp-2">{card.title || "—"}</span>
                  </td>
                  <td className="px-4 py-3 align-middle text-zinc-400 sm:px-5">
                    {categoryLabel(card.category)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle tabular-nums text-zinc-300 sm:px-5">
                    {formatCardPrice(card.price, "BYN")}
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/25">
                      Активна
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right align-middle sm:px-5">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <Link
                        href={`/card/${card.id}`}
                        className="inline-flex text-sm font-medium text-purple-400 transition hover:text-purple-300 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Открыть
                      </Link>
                      {onEdit ? (
                        <button
                          type="button"
                          onClick={() => onEdit(card)}
                          className="rounded bg-amber-500 px-3 py-1 text-sm font-medium text-black transition hover:bg-amber-400"
                        >
                          Редактировать
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => deleteCard(card.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
