"use client";

import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { PrivacyConsentCheckbox } from "@/app/components/PrivacyConsentCheckbox";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (email: string) => void;
};

export function GuestEmailModal({ open, onClose, onSubmit }: Props) {
  const titleId = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [privacyOk, setPrivacyOk] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setError(null);
      setPrivacyOk(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const t = email.trim();
      if (!privacyOk) {
        setError("Нужно согласие с политикой конфиденциальности.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
        setError("Введите корректный email.");
        return;
      }
      setError(null);
      onSubmit(t);
    },
    [email, onSubmit, privacyOk]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1a1e] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-white"
          aria-label="Закрыть"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 id={titleId} className="pr-10 text-xl font-semibold text-white">
          Приветствуем, гость!
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Укажите email для получения подтверждения заказа.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="guest-email" className="sr-only">
              Email
            </label>
            <input
              id="guest-email"
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#5D6BF3]/60 focus:outline-none focus:ring-2 focus:ring-[#5D6BF3]/25"
            />
            {error ? (
              <p className="mt-2 text-sm text-red-400">{error}</p>
            ) : null}
          </div>

          <PrivacyConsentCheckbox
            id="guest-checkout-privacy"
            checked={privacyOk}
            onChange={setPrivacyOk}
            required
          />

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#5D6BF3] py-3.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Продолжить
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
              →
            </span>
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500">
          <Link
            href="/login"
            className="text-[#5D6BF3] hover:underline"
            onClick={onClose}
          >
            Войдите или зарегистрируйтесь
          </Link>
          {" "}
          в личном кабинете, чтобы копить бонусы за покупки.
        </p>
      </div>
    </div>
  );
}
