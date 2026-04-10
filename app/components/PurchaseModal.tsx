"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function PurchaseModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[410] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-purple-950/50 backdrop-blur-md"
        onClick={onClose}
        aria-label="Закрыть"
      />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl border border-purple-500/30 bg-gradient-to-b from-zinc-950/98 to-black/95 p-8 shadow-[0_0_80px_rgba(168,85,247,0.35)] ring-1 ring-purple-400/20"
        role="dialog"
        aria-labelledby="purchase-title"
        aria-modal="true"
      >
        <h2
          id="purchase-title"
          className="bg-gradient-to-r from-purple-200 via-violet-300 to-fuchsia-300 bg-clip-text text-2xl font-bold text-transparent"
        >
          Покупка
        </h2>
        <p className="mt-4 text-zinc-400">Скоро</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-8 w-full rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 py-3.5 font-semibold text-white shadow-[0_0_28px_rgba(168,85,247,0.45)] ring-1 ring-purple-400/30 transition hover:from-purple-500 hover:via-violet-500 hover:to-fuchsia-500 hover:shadow-[0_0_40px_rgba(192,132,252,0.55)]"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}
