"use client";

import { useEffect, useRef } from "react";
import { apiUrl } from "@/app/lib/apiUrl";
import {
  TG_LOGIN_WAIT_STORAGE_KEY,
  isValidLoginWaitId,
} from "@/app/lib/telegramLoginWaitKeys";

const POLL_MS = 1500;
const MAX_MS = 8 * 60 * 1000;
const ACCOUNT_REDIRECT_URL = "https://www.illucards.by/account";

declare global {
  interface Window {
    __illucardsTgLoginPopup?: Window | null;
  }
}

/**
 * Пока в sessionStorage лежит wait_id после «Войти через Telegram»,
 * опрашиваем сайт: когда бот записал код и пометил ожидание — переход на /account.
 */
export function TelegramLoginWaitPoller() {
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const tick = async () => {
      let waitId: string | null = null;
      try {
        waitId = sessionStorage.getItem(TG_LOGIN_WAIT_STORAGE_KEY);
      } catch {
        return;
      }
      if (!waitId || !isValidLoginWaitId(waitId)) {
        startedAt.current = null;
        return;
      }
      if (startedAt.current == null) startedAt.current = Date.now();
      if (Date.now() - startedAt.current > MAX_MS) {
        try {
          sessionStorage.removeItem(TG_LOGIN_WAIT_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        startedAt.current = null;
        return;
      }
      try {
        const res = await fetch(
          apiUrl(
            `/api/telegram-login-wait?wait_id=${encodeURIComponent(waitId)}`,
          ),
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { ready?: boolean };
        if (data.ready) {
          try {
            sessionStorage.removeItem(TG_LOGIN_WAIT_STORAGE_KEY);
          } catch {
            /* ignore */
          }
          try {
            window.__illucardsTgLoginPopup?.close();
            window.__illucardsTgLoginPopup = null;
          } catch {
            /* ignore */
          }
          startedAt.current = null;
          window.location.assign(ACCOUNT_REDIRECT_URL);
        }
      } catch {
        /* ignore */
      }
    };

    const id = window.setInterval(() => void tick(), POLL_MS);
    void tick();
    return () => window.clearInterval(id);
  }, []);

  return null;
}
