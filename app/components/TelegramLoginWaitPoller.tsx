"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/app/context/AuthContext";
import {
  completeLoginWaitIfReady,
  redirectAfterTelegramLogin,
  stashTelegramLoginAutoError,
} from "@/app/lib/runTelegramLoginWaitCompletion";
import {
  readLoginWaitId,
  TG_LOGIN_WAIT_STARTED_EVENT,
} from "@/app/lib/telegramLoginWaitStorage";

const POLL_MS = 1200;
const MAX_MS = 8 * 60 * 1000;

declare global {
  interface Window {
    __illucardsTgLoginPopup?: Window | null;
  }
}

/**
 * После «Войти через Telegram» ждём подтверждения в боте и входим автоматически.
 */
export function TelegramLoginWaitPoller() {
  const { establishSessionFromTelegramUserId } = useAuth();
  const startedAt = useRef<number | null>(null);
  const completing = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const closePopup = () => {
      try {
        window.__illucardsTgLoginPopup?.close();
      } catch {
        /* ignore */
      }
      window.__illucardsTgLoginPopup = null;
    };

    const tick = async () => {
      if (completing.current) return;

      const waitId = readLoginWaitId();
      if (!waitId) {
        startedAt.current = null;
        return;
      }
      if (startedAt.current == null) startedAt.current = Date.now();
      if (Date.now() - startedAt.current > MAX_MS) {
        return;
      }

      completing.current = true;
      try {
        const result = await completeLoginWaitIfReady(
          waitId,
          establishSessionFromTelegramUserId,
        );
        if (result.ok) {
          closePopup();
          window.setTimeout(closePopup, 120);
          redirectAfterTelegramLogin();
          return;
        }
        if (!result.pending && result.error) {
          stashTelegramLoginAutoError(result.error);
        }
      } catch {
        /* ignore */
      } finally {
        completing.current = false;
      }
    };

    const onWake = () => {
      void tick();
    };

    const id = window.setInterval(() => void tick(), POLL_MS);
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("pageshow", onWake);
    window.addEventListener(TG_LOGIN_WAIT_STARTED_EVENT, onWake);
    void tick();

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("pageshow", onWake);
      window.removeEventListener(TG_LOGIN_WAIT_STARTED_EVENT, onWake);
    };
  }, [establishSessionFromTelegramUserId]);

  return null;
}
