"use client";

import { useCurrency, type DisplayCurrency } from "../context/CurrencyContext";

const OPTIONS: { currency: DisplayCurrency; title: string; text: string }[] = [
  {
    currency: "BYN",
    title: "BYN",
    text: "Белорусские рубли",
  },
  {
    currency: "RUB",
    title: "RUB",
    text: "Российские рубли",
  },
];

export function CurrencyPrompt() {
  const { hydrated, needsCurrencyPrompt, setCurrency } = useCurrency();

  if (!hydrated || !needsCurrencyPrompt) return null;

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="currency-prompt-title"
        className="w-full max-w-md rounded-3xl border border-violet-400/25 bg-zinc-950 p-6 text-center shadow-[0_0_80px_rgba(124,58,237,0.35)] ring-1 ring-white/10 sm:p-7"
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xl font-black text-white shadow-[0_0_32px_rgba(168,85,247,0.55)]">
          ₽
        </div>
        <h2
          id="currency-prompt-title"
          className="bg-gradient-to-r from-white via-purple-100 to-violet-200 bg-clip-text text-2xl font-bold tracking-tight text-transparent"
        >
          В какой валюте удобнее смотреть цены?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Выбор сохранится на сайте. Потом валюту можно поменять в верхнем меню.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {OPTIONS.map((option) => (
            <button
              key={option.currency}
              type="button"
              onClick={() => setCurrency(option.currency)}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-left transition hover:border-violet-400/50 hover:bg-violet-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
            >
              <span className="block text-lg font-bold text-white">{option.title}</span>
              <span className="mt-1 block text-sm text-zinc-400">{option.text}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
