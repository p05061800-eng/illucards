"use client";

import { useEffect, useRef } from "react";
import { apiUrl } from "@/app/lib/apiUrl";
import { useAuth } from "@/app/context/AuthContext";
import {
  accountUrlAfterTelegramLogin,
  finishTelegramWebLoginOnClient,
  pollLoginWait,
} from "@/app/lib/completeTelegramWebLoginClient";
import {
  TG_LOGIN_AUTO_ERROR_KEY,
  TG_LOGIN_WAIT_STORAGE_KEY,
  isValidLoginWaitId,
} from "@/app/lib/telegramLoginWaitKeys";

const POLL_MS = 1500;
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

    const tick = async () => {
      if (completing.current) return;

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

      const poll = await pollLoginWait(waitId);
      if (!poll.ready || poll.user_id == null || poll.user_id <= 0) return;

      completing.current = true;

      const closePopup = () => {
        try {
          window.__illucardsTgLoginPopup?.close();
        } catch {
          /* ignore */
        }
      };
      closePopup();
      window.setTimeout(closePopup, 120);
      window.setTimeout(closePopup, 350);
      window.__illucardsTgLoginPopup = null;

      const result = await finishTelegramWebLoginOnClient(
        waitId,
        establishSessionFromTelegramUserId,
        {
          knownProfile: {
            user_id: poll.user_id,
            username: poll.username ?? undefined,
          },
        },
      );
      try {
        sessionStorage.removeItem(TG_LOGIN_WAIT_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      startedAt.current = null;

      if (result.ok) {
        window.location.assign(accountUrlAfterTelegramLogin());
        return;
      }

      try {
        sessionStorage.setItem(TG_LOGIN_AUTO_ERROR_KEY, result.error);
      } catch {
        /* ignore */
      }
      completing.current = false;
    };

    const id = window.setInterval(() => void tick(), POLL_MS);
    void tick();
    return () => window.clearInterval(id);
  }, [establishSessionFromTelegramUserId]);

  return null;
}
