"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { PrivacyConsentCheckbox } from "@/app/components/PrivacyConsentCheckbox";
import { TelegramLoginWidget } from "@/app/components/TelegramLoginWidget";
import { useAuth } from "@/app/context/AuthContext";
import {
  getTelegramBotUsername,
  type TelegramWidgetAuthPayload,
} from "@/app/lib/telegramAuth";

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/account";
  const { login, loginWithTelegram, establishSessionFromTelegramUserId, hydrated } =
    useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [telegramCode, setTelegramCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [privacyOk, setPrivacyOk] = useState(false);
  const [tgBusy, setTgBusy] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);

  const botUsername = getTelegramBotUsername();

  const handleTelegramAuth = useCallback(
    async (payload: TelegramWidgetAuthPayload) => {
      setError(null);
      if (!privacyOk) {
        setError("Нужно согласие с политикой конфиденциальности.");
        return;
      }
      setTgBusy(true);
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          profile?: {
            telegramId: number;
            firstName: string;
            lastName: string | null;
            username: string | null;
            photoUrl: string | null;
          };
        };
        if (!res.ok || !data.ok || !data.profile) {
          setError(data.error ?? "Не удалось подтвердить Telegram.");
          return;
        }
        const r = loginWithTelegram(data.profile);
        if (r.ok) {
          router.push(next.startsWith("/") ? next : "/account");
          router.refresh();
        } else {
          setError(r.error);
        }
      } catch {
        setError("Ошибка сети. Попробуйте ещё раз.");
      } finally {
        setTgBusy(false);
      }
    },
    [privacyOk, loginWithTelegram, router, next]
  );

  const handleTelegramCodeLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!privacyOk) {
        setError("Нужно согласие с политикой конфиденциальности.");
        return;
      }
      const code = telegramCode.trim();
      if (!code) {
        setError("Введите код из Telegram.");
        return;
      }
      setCodeBusy(true);
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          user_id?: number;
        };
        if (!res.ok || !data.ok || typeof data.user_id !== "number") {
          if (res.status === 401) {
            setError("Неверный или устаревший код");
          } else {
            setError(data.error ?? "Неверный или устаревший код");
          }
          return;
        }
        try {
          localStorage.setItem("user_id", String(data.user_id));
        } catch {
          /* ignore */
        }
        const r = establishSessionFromTelegramUserId(data.user_id);
        if (r.ok) {
          router.push(next.startsWith("/") ? next : "/account");
          router.refresh();
        } else {
          setError(r.error);
        }
      } catch {
        setError("Ошибка сети. Попробуйте ещё раз.");
      } finally {
        setCodeBusy(false);
      }
    },
    [
      telegramCode,
      privacyOk,
      establishSessionFromTelegramUserId,
      router,
      next,
    ]
  );

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
        Личный кабинет IlluCards (данные в этом браузере)
      </p>

      <div className="mt-10 space-y-4 rounded-2xl border border-white/[0.08] bg-zinc-950/60 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        <PrivacyConsentCheckbox
          id="login-privacy"
          checked={privacyOk}
          onChange={setPrivacyOk}
          required
        />

        <form onSubmit={handleTelegramCodeLogin} className="space-y-3">
          <label htmlFor="telegram-auth-code" className="sr-only">
            Код из Telegram
          </label>
          <input
            id="telegram-auth-code"
            name="telegram-auth-code"
            type="text"
            autoComplete="one-time-code"
            placeholder="Введите код из Telegram"
            value={telegramCode}
            onChange={(e) => setTelegramCode(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#5D6BF3]/60 focus:outline-none focus:ring-2 focus:ring-[#5D6BF3]/25"
          />
          <button
            type="submit"
            disabled={codeBusy}
            className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {codeBusy ? "Проверяем…" : "Войти"}
          </button>
        </form>

        <div className="relative py-2 text-center text-xs text-zinc-600">
          <span className="relative z-10 bg-zinc-950/60 px-2">
            или виджет Telegram
          </span>
          <span className="absolute left-0 right-0 top-1/2 z-0 h-px bg-white/10" aria-hidden />
        </div>

        <div>
          <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-zinc-500">
            Через Telegram
          </p>
          {tgBusy ? (
            <p className="text-center text-sm text-zinc-400">Проверяем…</p>
          ) : (
            <TelegramLoginWidget botUsername={botUsername} onAuth={handleTelegramAuth} />
          )}
        </div>

        <div className="relative py-2 text-center text-xs text-zinc-600">
          <span className="relative z-10 bg-zinc-950/60 px-2">или email, если аккаунт создан раньше</span>
          <span className="absolute left-0 right-0 top-1/2 z-0 h-px bg-white/10" aria-hidden />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
          <button
            type="submit"
            className="w-full rounded-xl bg-[#5D6BF3] py-3.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Войти по email
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Нет аккаунта?{" "}
        <Link
          href={next !== "/account" ? `/register?next=${encodeURIComponent(next)}` : "/register"}
          className="text-[#5D6BF3] hover:underline"
        >
          Регистрация через Telegram
        </Link>
      </p>
    </div>
  );
}
