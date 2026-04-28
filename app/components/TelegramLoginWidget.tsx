"use client";

import { useEffect, useRef } from "react";
import type { TelegramWidgetAuthPayload } from "@/app/lib/telegramAuth";

declare global {
  interface Window {
    TelegramLogin__illucards?: (user: TelegramWidgetAuthPayload) => void;
  }
}

type Props = {
  botUsername: string;
  /**
   * `redirect` — официальный виджет с `data-auth-url` (GET /api/auth/telegram).
   * `callback` — `data-onauth` и обработка на клиенте (например POST).
   */
  authMode?: "redirect" | "callback";
  /** Только для `authMode="callback"`. */
  onAuth?: (user: TelegramWidgetAuthPayload) => void | Promise<void>;
};

/**
 * Виджет входа Telegram. В @BotFather укажите домен сайта;
 * `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, `TELEGRAM_BOT_TOKEN`.
 */
export function TelegramLoginWidget({
  botUsername,
  authMode = "callback",
  onAuth,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onAuthRef = useRef(onAuth);

  useEffect(() => {
    onAuthRef.current = onAuth;
  }, [onAuth]);

  useEffect(() => {
    const name = botUsername.replace(/^@/, "").trim();
    const el = hostRef.current;
    if (!el || !name) return;

    el.replaceChildren();

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", name);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-request-access", "write");

    if (authMode === "redirect") {
      const origin = window.location.origin.replace(/\/$/, "");
      script.setAttribute("data-auth-url", `${origin}/api/auth/telegram`);
    } else {
      window.TelegramLogin__illucards = (user: TelegramWidgetAuthPayload) => {
        void Promise.resolve(onAuthRef.current?.(user));
      };
      script.setAttribute("data-onauth", "TelegramLogin__illucards");
    }

    el.appendChild(script);

    return () => {
      if (authMode === "callback") {
        delete window.TelegramLogin__illucards;
      }
      el.replaceChildren();
    };
  }, [botUsername, authMode]);

  if (!botUsername.replace(/^@/, "").trim()) {
    return (
      <p className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-sm text-amber-100">
        Для входа через Telegram задайте в .env переменную{" "}
        <code className="rounded bg-black/40 px-1 text-xs">NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code>{" "}
        (имя бота без @).
      </p>
    );
  }

  return <div ref={hostRef} className="flex min-h-[44px] justify-center [&_iframe]:max-w-full" />;
}
