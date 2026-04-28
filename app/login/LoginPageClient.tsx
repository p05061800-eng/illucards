"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { getTelegramBotUsername } from "@/app/lib/telegramAuth";
import { TELEGRAM_ORDER_BOT_DEFAULT } from "@/app/lib/telegramOrderCheckout";

/** Открыть бота; `start` помечает сценарий «вход с сайта». */
function telegramBotLoginUrl(): string {
  const raw = getTelegramBotUsername().trim() || TELEGRAM_ORDER_BOT_DEFAULT;
  const name = raw.replace(/^@/, "").trim();
  return `https://t.me/${encodeURIComponent(name)}?start=web_login`;
}

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/account";
  const { hydrated, primaryTelegramUserId } = useAuth();

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
    if (!hydrated) return;
    if (primaryTelegramUserId == null) return;
    let dest = next;
    try {
      const stored = sessionStorage.getItem("illucards_tg_login_next");
      if (stored && stored.startsWith("/")) dest = stored;
    } catch {
      /* ignore */
    }
    router.replace(dest.startsWith("/") ? dest : "/account");
  }, [hydrated, primaryTelegramUserId, next, router]);

  if (!hydrated) {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-lg items-center justify-center px-4 py-20">
        <p className="text-sm text-zinc-500">Загрузка…</p>
      </div>
    );
  }

  if (primaryTelegramUserId != null) {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-lg items-center justify-center px-4 py-20">
        <p className="text-sm text-zinc-500">Переход в кабинет…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 sm:px-6 sm:pt-12 md:max-w-xl">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Вход
        </h1>
        <p className="mt-2 text-sm text-zinc-400 sm:text-base">
          Через Telegram — без паролей. Бот пришлёт ссылку с вашим id.
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl bg-zinc-50 text-left text-zinc-900 shadow-[0_2px_16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-200/90 sm:rounded-3xl">
        <div className="bg-white px-5 py-7 sm:px-8 sm:py-9">
          <a
            href={telegramBotLoginUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 text-base font-semibold text-white shadow-md transition hover:brightness-105 active:scale-[0.99] sm:min-h-[3.5rem] sm:text-lg"
          >
            <MessageCircle className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
            Войти через Telegram
          </a>
          <p className="mt-5 text-sm leading-relaxed text-zinc-600 sm:text-base">
            Нажмите кнопку, откройте бота и следуйте подсказкам. Когда бот
            пришлёт ссылку на сайт, откройте её — вход сохранится в этом
            браузере.
          </p>
        </div>
      </div>

      <p className="mt-8 text-center text-xs leading-relaxed text-zinc-500 sm:text-sm">
        Продолжая, вы соглашаетесь с{" "}
        <Link href="/privacy" className="text-violet-400 underline-offset-2 hover:underline">
          политикой конфиденциальности
        </Link>
        .
      </p>

      <p className="mt-4 text-center text-sm text-zinc-500">
        <Link href="/" className="text-zinc-400 transition hover:text-white">
          ← На главную
        </Link>
      </p>
    </div>
  );
}
