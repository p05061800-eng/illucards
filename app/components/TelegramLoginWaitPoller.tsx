"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { pollLoginWait } from "@/app/lib/completeTelegramWebLoginClient";
import {
  completeLoginWaitIfReady,
  redirectAfterTelegramLogin,
  stashTelegramLoginAutoError,
} from "@/app/lib/runTelegramLoginWaitCompletion";
import { completePendingTelegramCheckoutAfterLogin } from "@/app/lib/completePendingTelegramCheckoutAfterLogin";
import {
  readLoginWaitId,
  TG_LOGIN_WAIT_STARTED_EVENT,
} from "@/app/lib/telegramLoginWaitStorage";

const POLL_MS = 800;
const MAX_MS = 10 * 60 * 1000;

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
  const establishRef = useRef(establishSessionFromTelegramUserId);
  establishRef.current = establishSessionFromTelegramUserId;

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
      if (Date.now() - startedAt.current > MAX_MS) return;

      const poll = await pollLoginWait(waitId);
      if (!poll.ready || poll.user_id == null || poll.user_id <= 0) return;

      completing.current = true;
      try {
        const result = await completeLoginWaitIfReady(
          waitId,
          establishRef.current,
        );
        if (result.ok) {
          closePopup();
          window.setTimeout(closePopup, 120);
          const checkout = await completePendingTelegramCheckoutAfterLogin(
            result.user_id,
            poll.username,
          );
          if (checkout === "redirected" || checkout === "in_progress") return;
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
      if (document.visibilityState === "visible") void tick();
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
  }, []);

  return null;
}
