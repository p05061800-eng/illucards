import {
  finishTelegramWebLoginOnClient,
  pollLoginWait,
  waitForLoginWaitReady,
} from "@/app/lib/completeTelegramWebLoginClient";
import { TG_LOGIN_AUTO_ERROR_KEY } from "@/app/lib/telegramLoginWaitKeys";
import {
  clearLoginWaitId,
  readLoginWaitId,
} from "@/app/lib/telegramLoginWaitStorage";
import type { LoginWaitProfile } from "@/app/lib/telegramLoginWaitStore";

type EstablishSession = (
  telegramUserId: number,
  options?: { telegramUsername?: string | null },
) => { ok: true } | { ok: false; error: string };

export type RunTelegramLoginWaitResult =
  | { ok: true; user_id: number }
  | { ok: false; error: string; pending?: boolean; noWaitId?: boolean };

function profileFromPoll(
  poll: Awaited<ReturnType<typeof pollLoginWait>>,
): LoginWaitProfile | null {
  if (!poll.ready || poll.user_id == null || poll.user_id <= 0) return null;
  return {
    user_id: poll.user_id,
    username: poll.username ?? undefined,
  };
}

async function finishWithProfile(
  waitId: string,
  establishSessionFromTelegramUserId: EstablishSession,
  profile: LoginWaitProfile,
): Promise<RunTelegramLoginWaitResult> {
  const result = await finishTelegramWebLoginOnClient(
    waitId,
    establishSessionFromTelegramUserId,
    { knownProfile: profile },
  );
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  clearLoginWaitId();
  return { ok: true, user_id: result.user_id };
}

/** Быстрая проверка: бот уже подтвердил? Завершить вход без долгого ожидания. */
export async function completeLoginWaitIfReady(
  waitId: string,
  establishSessionFromTelegramUserId: EstablishSession,
): Promise<RunTelegramLoginWaitResult> {
  const id = waitId.trim().toLowerCase();
  const poll = await pollLoginWait(id);
  if (!poll.ready) {
    return { ok: false, error: "", pending: true };
  }

  const profile = profileFromPoll(poll);
  if (profile) {
    return finishWithProfile(id, establishSessionFromTelegramUserId, profile);
  }

  const result = await finishTelegramWebLoginOnClient(
    id,
    establishSessionFromTelegramUserId,
    null,
  );
  if (result.ok) {
    clearLoginWaitId();
    return { ok: true, user_id: result.user_id };
  }
  return {
    ok: false,
    error: result.error,
    pending: result.status === 401,
  };
}

/**
 * Дождаться подтверждения в боте и завершить вход.
 * Для страницы /account после «Войти через Telegram».
 */
export async function runTelegramLoginWaitCompletion(
  waitId: string,
  establishSessionFromTelegramUserId: EstablishSession,
  options?: { waitTimeoutMs?: number },
): Promise<RunTelegramLoginWaitResult> {
  const id = waitId.trim().toLowerCase();

  const readyNow = await completeLoginWaitIfReady(
    id,
    establishSessionFromTelegramUserId,
  );
  if (readyNow.ok || !readyNow.pending) return readyNow;

  const profile = await waitForLoginWaitReady(id, {
    timeoutMs: options?.waitTimeoutMs ?? 8 * 60 * 1000,
    intervalMs: 1200,
  });
  if (!profile) {
    return {
      ok: false,
      error:
        "Подтверждение в Telegram ещё не получено. Нажмите Start в боте и вернитесь на вкладку с сайтом.",
      pending: true,
    };
  }

  return finishWithProfile(id, establishSessionFromTelegramUserId, profile);
}

export function redirectAfterTelegramLogin(): void {
  if (typeof window === "undefined") return;
  window.location.replace(`${window.location.origin}/account`);
}

export function stashTelegramLoginAutoError(message: string): void {
  try {
    sessionStorage.setItem(TG_LOGIN_AUTO_ERROR_KEY, message);
  } catch {
    /* ignore */
  }
}

/** Попробовать завершить вход по wait_id из storage (focus / pageshow). */
export async function tryCompleteLoginWaitFromStorage(
  establishSessionFromTelegramUserId: EstablishSession,
): Promise<RunTelegramLoginWaitResult> {
  const waitId = readLoginWaitId();
  if (!waitId) return { ok: false, error: "", noWaitId: true };
  return completeLoginWaitIfReady(waitId, establishSessionFromTelegramUserId);
}
