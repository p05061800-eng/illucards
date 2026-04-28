"use client";

import Link from "next/link";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PrivacyConsentCheckbox } from "@/app/components/PrivacyConsentCheckbox";
import { TelegramLoginWidget } from "@/app/components/TelegramLoginWidget";
import { useAuth } from "@/app/context/AuthContext";
import { getTelegramBotUsername } from "@/app/lib/telegramAuth";
import { fetchTelegramWidgetBootstrapOnce } from "./telegramWidgetBootstrap";

function botLink(): string {
  const u = getTelegramBotUsername().trim();
  const name = u || "illucards_bot";
  return `https://t.me/${encodeURIComponent(name)}`;
}

function loginHrefWithoutTg(sp: Pick<ReadonlyURLSearchParams, "get">): string {
  const n = new URLSearchParams();
  const nx = sp.get("next");
  if (nx && nx.startsWith("/")) n.set("next", nx);
  const q = n.toString();
  return q ? `/login?${q}` : "/login";
}

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/account";
  const {
    loginWithTelegram,
    registerWithTelegram,
    establishSessionFromTelegramUserId,
    hydrated,
  } = useAuth();

  const [telegramUsername, setTelegramUsername] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [privacyOk, setPrivacyOk] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  /** Сообщение после редиректа с виджета Telegram */
  const [widgetLine, setWidgetLine] = useState<"none" | "loading" | "success" | "error">("none");

  const botUsername = getTelegramBotUsername() || "illucards_bot";

  useEffect(() => {
    try {
      const n = searchParams.get("next");
      if (n && n.startsWith("/")) {
        sessionStorage.setItem("illucards_tg_login_next", n);
      }
    } catch {
      /* ignore */
    }
  }, [searchParams]);

  useEffect(() => {
    const tg = searchParams.get("tg");
    if (tg === "err") {
      setWidgetLine("error");
      router.replace(loginHrefWithoutTg(searchParams));
      return;
    }
    if (tg !== "widget") return;

    let cancelled = false;
    setWidgetLine("loading");

    (async () => {
      try {
        const result = await fetchTelegramWidgetBootstrapOnce();
        if (cancelled) return;

        if (!result.ok) {
          setWidgetLine("error");
          router.replace(loginHrefWithoutTg(searchParams));
          return;
        }

        let r = loginWithTelegram(result.profile);
        if (!r.ok) {
          r = registerWithTelegram(result.profile);
        }
        if (!r.ok) {
          setWidgetLine("error");
          router.replace(loginHrefWithoutTg(searchParams));
          return;
        }

        setWidgetLine("success");
        router.replace(loginHrefWithoutTg(searchParams));

        let dest = next;
        try {
          const stored = sessionStorage.getItem("illucards_tg_login_next");
          if (stored && stored.startsWith("/")) dest = stored;
        } catch {
          /* ignore */
        }

        window.setTimeout(() => {
          if (cancelled) return;
          router.push(dest.startsWith("/") ? dest : "/account");
          router.refresh();
        }, 1600);
      } catch {
        if (!cancelled) {
          setWidgetLine("error");
          router.replace(loginHrefWithoutTg(searchParams));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router, next, loginWithTelegram, registerWithTelegram]);

  const requirePrivacy = useCallback((): boolean => {
    if (!privacyOk) {
      setError("Нужно согласие с политикой конфиденциальности.");
      return false;
    }
    return true;
  }, [privacyOk]);

  const handleSendCode = useCallback(async () => {
    setError(null);
    if (!requirePrivacy()) return;
    const u = telegramUsername.trim();
    if (!u) {
      setError("Введите username Telegram.");
      return;
    }
    setSendBusy(true);
    try {
      const res = await fetch("/api/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u.startsWith("@") ? u : `@${u}` }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Не удалось отправить код.");
        return;
      }
      setError(null);
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.");
    } finally {
      setSendBusy(false);
    }
  }, [requirePrivacy, telegramUsername]);

  const handleVerifyLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!requirePrivacy()) return;
      const u = telegramUsername.trim();
      if (!u) {
        setError("Введите username Telegram.");
        return;
      }
      const c = code.replace(/\D/g, "");
      if (c.length !== 4) {
        setError("Введите 4 цифры кода из Telegram.");
        return;
      }
      setLoginBusy(true);
      try {
        const res = await fetch("/api/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: u.startsWith("@") ? u : `@${u}`,
            code: c,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          ok?: boolean;
          user_id?: number;
          username?: string;
        };
        if (!res.ok || !data.ok || typeof data.user_id !== "number") {
          setError(data.error ?? "Неверный или просроченный код.");
          return;
        }
        const r = establishSessionFromTelegramUserId(data.user_id, {
          telegramUsername: data.username ?? null,
        });
        if (r.ok) {
          router.push(next.startsWith("/") ? next : "/account");
          router.refresh();
        } else {
          setError(r.error);
        }
      } catch {
        setError("Ошибка сети. Попробуйте ещё раз.");
      } finally {
        setLoginBusy(false);
      }
    },
    [
      code,
      establishSessionFromTelegramUserId,
      requirePrivacy,
      router,
      next,
      telegramUsername,
    ],
  );

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center text-sm text-zinc-500">
        Загрузка…
      </div>
    );
  }

  const showWidgetSuccess =
    widgetLine === "success" || widgetLine === "loading";
  const showWidgetError = widgetLine === "error";

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-24 pt-16 sm:pt-24">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Вход
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          IlluCards — личный кабинет в этом браузере
        </p>
      </div>

      <div className="mt-8 space-y-5 rounded-2xl border border-violet-500/25 bg-gradient-to-b from-violet-950/40 via-zinc-950/80 to-black/80 p-6 shadow-[0_24px_80px_rgba(88,28,135,0.25)] ring-1 ring-inset ring-white/[0.06] sm:p-8">
        {showWidgetSuccess ? (
          <p className="rounded-xl border border-emerald-500/35 bg-emerald-950/30 px-3 py-2.5 text-center text-sm font-medium text-emerald-100">
            {widgetLine === "loading"
              ? "Входим через Telegram…"
              : "✅ Вы вошли через Telegram"}
          </p>
        ) : null}
        {showWidgetError ? (
          <p
            className="rounded-xl border border-red-500/35 bg-red-950/35 px-3 py-2.5 text-center text-sm font-medium text-red-100"
            role="alert"
          >
            ❌ Ошибка авторизации
          </p>
        ) : null}

        <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 px-4 py-4">
          <h2 className="text-center text-lg font-semibold text-white">
            🔐 Вход через Telegram
          </h2>
          <p className="mt-1.5 text-center text-xs text-zinc-400 sm:text-sm">
            Войдите одним нажатием — откроется Telegram и вернёт вас на сайт
          </p>
          <div className="mt-4 flex justify-center">
            {privacyOk ? (
              <TelegramLoginWidget botUsername={botUsername} authMode="redirect" />
            ) : (
              <p className="text-center text-xs text-zinc-500">
                Отметьте согласие с политикой ниже — затем появится кнопка виджета.
              </p>
            )}
          </div>
        </div>

        <PrivacyConsentCheckbox
          id="login-privacy"
          checked={privacyOk}
          onChange={setPrivacyOk}
          required
        />

        <div className="relative py-2 text-center text-xs text-zinc-600">
          <span className="relative z-10 bg-zinc-950/80 px-2">или по коду из Telegram</span>
          <span
            className="absolute left-0 right-0 top-1/2 z-0 h-px bg-white/10"
            aria-hidden
          />
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-black/30 px-4 py-3 text-left text-sm leading-relaxed text-zinc-300">
          <p className="font-medium text-violet-200/95">Введите код из Telegram</p>
          <p className="mt-2 text-xs text-zinc-500 sm:text-sm">Чтобы войти:</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs text-zinc-400 sm:text-sm">
            <li>
              Напишите боту{" "}
              <a
                href={botLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-violet-300 underline-offset-2 hover:text-violet-200 hover:underline"
              >
                /start
              </a>
            </li>
            <li>Введите ваш @username ниже</li>
            <li>Нажмите «Получить код» и введите 4 цифры из чата</li>
          </ol>
        </div>

        {error ? (
          <p
            className="rounded-xl border border-red-500/35 bg-red-950/35 px-3 py-2.5 text-sm text-red-100"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <form onSubmit={handleVerifyLogin} className="space-y-4">
          <div>
            <label
              htmlFor="login-tg-username"
              className="mb-1.5 block text-xs font-medium text-zinc-400"
            >
              Username Telegram (@username)
            </label>
            <input
              id="login-tg-username"
              name="telegram-username"
              type="text"
              autoComplete="username"
              placeholder="@username"
              value={telegramUsername}
              onChange={(e) => setTelegramUsername(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/50 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
          </div>
          <div>
            <label
              htmlFor="login-tg-code"
              className="mb-1.5 block text-xs font-medium text-zinc-400"
            >
              Код (4 цифры)
            </label>
            <input
              id="login-tg-code"
              name="telegram-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="0000"
              maxLength={4}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              className="w-full rounded-xl border border-white/15 bg-black/50 px-4 py-3 text-center font-mono text-lg tracking-[0.35em] text-white placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => {
                void handleSendCode();
              }}
              disabled={sendBusy}
              className="w-full rounded-xl border border-violet-400/40 bg-violet-950/50 py-3.5 text-sm font-semibold text-violet-100 transition hover:border-violet-400/60 hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
            >
              {sendBusy ? "Отправляем…" : "Получить код"}
            </button>
            <button
              type="submit"
              disabled={loginBusy}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
            >
              {loginBusy ? "Входим…" : "Войти"}
            </button>
          </div>
        </form>
      </div>

      <p className="mt-8 text-center text-sm text-zinc-500">
        Нет аккаунта?{" "}
        <Link
          href={
            next !== "/account"
              ? `/register?next=${encodeURIComponent(next)}`
              : "/register"
          }
          className="text-violet-400 hover:underline"
        >
          Регистрация
        </Link>
      </p>
    </div>
  );
}
