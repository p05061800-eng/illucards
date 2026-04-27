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

export default function RegisterPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/account";
  const { registerWithTelegram, hydrated } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [privacyOk, setPrivacyOk] = useState(false);

  const botUsername = getTelegramBotUsername();

  const handleTelegramAuth = useCallback(
    async (payload: TelegramWidgetAuthPayload) => {
      setError(null);
      if (!privacyOk) {
        setError("Нужно согласие с политикой конфиденциальности.");
        return;
      }
      setBusy(true);
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
        const r = registerWithTelegram(data.profile);
        if (r.ok) {
          router.push(next.startsWith("/") ? next : "/account");
          router.refresh();
        } else {
          setError(r.error);
        }
      } catch {
        setError("Ошибка сети. Попробуйте ещё раз.");
      } finally {
        setBusy(false);
      }
    },
    [privacyOk, registerWithTelegram, router, next]
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
        Регистрация
      </h1>
      <p className="mt-2 text-center text-sm text-zinc-500">
        Вход через Telegram — бонусы и история заказов хранятся в этом браузере (демо)
      </p>

      <div className="mt-10 space-y-5 rounded-2xl border border-white/[0.08] bg-zinc-950/60 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        <PrivacyConsentCheckbox
          id="register-privacy"
          checked={privacyOk}
          onChange={setPrivacyOk}
          required
        />
        <p className="text-center text-xs leading-relaxed text-zinc-500">
          После нажатия кнопки откроется авторизация Telegram. В @BotFather для бота укажите домен
          сайта и задайте{" "}
          <code className="rounded bg-black/40 px-1 text-zinc-400">TELEGRAM_BOT_TOKEN</code> и{" "}
          <code className="rounded bg-black/40 px-1 text-zinc-400">
            NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
          </code>
          .
        </p>
        <div className="flex flex-col items-center gap-3">
          {busy ? (
            <p className="text-sm text-zinc-400">Проверяем…</p>
          ) : (
            <TelegramLoginWidget botUsername={botUsername} onAuth={handleTelegramAuth} />
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Уже есть аккаунт?{" "}
        <Link
          href={next !== "/account" ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="text-[#5D6BF3] hover:underline"
        >
          Войти
        </Link>
      </p>
    </div>
  );
}
