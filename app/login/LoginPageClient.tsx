"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { PrivacyConsentCheckbox } from "@/app/components/PrivacyConsentCheckbox";
import { useAuth } from "@/app/context/AuthContext";

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/account";
  const { login, hydrated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [privacyOk, setPrivacyOk] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!privacyOk) {
        setError("Нужно согласие с политикой конфиденциальности.");
        return;
      }
      const r = login(email, password);
      if (r.ok) {
        router.push(next.startsWith("/") ? next : "/account");
        router.refresh();
      } else {
        setError(r.error);
      }
    },
    [email, password, privacyOk, login, router, next]
  );

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center text-sm text-zinc-500">
        Загрузка…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-24 pt-16 sm:pt-24">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-white">
        Вход
      </h1>
      <p className="mt-2 text-center text-sm text-zinc-500">
        Личный кабинет IlluCards (демо, данные в браузере)
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-10 space-y-4 rounded-2xl border border-white/[0.08] bg-zinc-950/60 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      >
        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        <div>
          <label htmlFor="login-email" className="mb-1.5 block text-xs text-zinc-500">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white focus:border-[#5D6BF3]/60 focus:outline-none focus:ring-2 focus:ring-[#5D6BF3]/25"
          />
        </div>
        <div>
          <label htmlFor="login-pass" className="mb-1.5 block text-xs text-zinc-500">
            Пароль
          </label>
          <input
            id="login-pass"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={4}
            className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white focus:border-[#5D6BF3]/60 focus:outline-none focus:ring-2 focus:ring-[#5D6BF3]/25"
          />
        </div>
        <PrivacyConsentCheckbox
          id="login-privacy"
          checked={privacyOk}
          onChange={setPrivacyOk}
          required
        />
        <button
          type="submit"
          className="w-full rounded-xl bg-[#5D6BF3] py-3.5 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Войти
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Нет аккаунта?{" "}
        <Link
          href={next !== "/account" ? `/register?next=${encodeURIComponent(next)}` : "/register"}
          className="text-[#5D6BF3] hover:underline"
        >
          Регистрация
        </Link>
      </p>
    </div>
  );
}
