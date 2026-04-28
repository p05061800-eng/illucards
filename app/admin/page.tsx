import type { Metadata } from "next";
import fs from "fs";
import Link from "next/link";
import path from "path";
import type { StoredCard } from "../api/cards/route";
import { parseCardsJson } from "../lib/cardsJson";
import { AdminTabs } from "./AdminTabs";

export const metadata: Metadata = {
  title: "Админ — IlluCards",
  description: "Добавление карточек в коллекцию",
};

function loadCards(): StoredCard[] {
  try {
    const filePath = path.join(process.cwd(), "data", "cards.json");
    const fileData = fs.readFileSync(filePath, "utf-8");
    return parseCardsJson(fileData);
  } catch {
    return [];
  }
}

export default function AdminPage() {
  const initialCards = loadCards();

  return (
    <main className="main relative overflow-x-hidden bg-black text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-20%,rgba(88,28,135,0.4),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 h-64 w-[120%] max-w-[min(100%,90rem)] -translate-x-1/2 rounded-full bg-purple-600/15 blur-[100px]"
        aria-hidden
      />
      <div className="relative z-10 p-8 md:p-12">
        <div className="mx-auto w-full max-w-[min(100%,90rem)]">
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                <span className="bg-gradient-to-r from-purple-300 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                  Админ
                </span>
              </h1>
              <p className="mt-2 text-zinc-400">
                Каталог, категории, заказы и заявки.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/categories"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-purple-400/40 hover:bg-white/10 hover:text-white"
              >
                Категории
              </Link>
              <Link
                href="/admin/menu"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-purple-400/40 hover:bg-white/10 hover:text-white"
              >
                Меню сайта
              </Link>
              <Link
                href="/admin/social"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-purple-400/40 hover:bg-white/10 hover:text-white"
              >
                Соцсети
              </Link>
              <Link
                href="/admin/promo"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-purple-400/40 hover:bg-white/10 hover:text-white"
              >
                Акции
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-purple-500/35 bg-purple-950/40 px-5 py-2.5 text-sm font-medium text-purple-100 shadow-[0_0_24px_rgba(168,85,247,0.25)] transition hover:border-purple-400/50 hover:bg-purple-900/50 hover:shadow-[0_0_36px_rgba(168,85,247,0.4)]"
              >
                ← На главную
              </Link>
            </div>
          </div>

          <AdminTabs initialCards={initialCards} />
        </div>
      </div>
    </main>
  );
}
