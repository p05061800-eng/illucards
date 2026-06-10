import { apiUrl } from "@/app/lib/apiUrl";
import { isValidLoginWaitId } from "@/app/lib/telegramLoginWaitKeys";
import { persistTelegramUserIdentity } from "@/app/lib/telegramUserIdentity";

export type CompleteTelegramWebLoginResult =
  | { ok: true; user_id: number; username: string | null }
  | { ok: false; error: string; status: number };

type EstablishSession = (
  telegramUserId: number,
  options?: { telegramUsername?: string | null },
) => { ok: true } | { ok: false; error: string };

/** Ждём, пока бот пометит wait_id готовым на сайте. */
export async function waitForLoginWaitReady(
  waitId: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<boolean> {
  const id = waitId.trim().toLowerCase();
  if (!isValidLoginWaitId(id)) return false;
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const intervalMs = options?.intervalMs ?? 1000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(
        apiUrl(`/api/telegram-login-wait?wait_id=${encodeURIComponent(id)}`),
        { cache: "no-store" },
      );
      if (res.ok) {
        const data = (await res.json()) as { ready?: boolean };
        if (data.ready) return true;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

/** Завершить web_login: сервер проверяет wait_id и возвращает Telegram user id. */
export async function completeTelegramWebLogin(
  waitId: string,
): Promise<CompleteTelegramWebLoginResult> {
  const id = waitId.trim().toLowerCase();
  if (!isValidLoginWaitId(id)) {
    return { ok: false, error: "Некорректная сессия входа", status: 400 };
  }
  try {
    const res = await fetch(apiUrl("/api/telegram-login-wait/complete"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ wait_id: id }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      user_id?: number;
      username?: string | null;
    };
    const uid = data.user_id;
    if (
      !res.ok ||
      typeof uid !== "number" ||
      !Number.isFinite(uid) ||
      uid <= 0
    ) {
      return {
        ok: false,
        error: data.error || "Не удалось выполнить автоматический вход",
        status: res.status || 502,
      };
    }
    return {
      ok: true,
      user_id: Math.floor(uid),
      username:
        typeof data.username === "string" && data.username.trim()
          ? data.username.trim().replace(/^@/, "")
          : null,
    };
  } catch {
    return { ok: false, error: "Ошибка сети", status: 0 };
  }
}

/** Автовход на клиенте: wait_id → сессия + cookie. */
export async function finishTelegramWebLoginOnClient(
  waitId: string,
  establishSessionFromTelegramUserId: EstablishSession,
  options?: { waitUntilReady?: boolean },
): Promise<CompleteTelegramWebLoginResult> {
  if (options?.waitUntilReady !== false) {
    const ready = await waitForLoginWaitReady(waitId);
    if (!ready) {
      return {
        ok: false,
        error: "Подтверждение в боте ещё не получено. Нажмите «Start» в боте и повторите.",
        status: 408,
      };
    }
  }

  const result = await completeTelegramWebLogin(waitId);
  if (!result.ok) return result;

  const established = establishSessionFromTelegramUserId(result.user_id, {
    telegramUsername: result.username,
  });
  if (!established.ok) {
    return { ok: false, error: established.error, status: 400 };
  }

  persistTelegramUserIdentity(result.user_id, result.username);

  try {
    await fetch("/api/auth/telegram-cookie", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: result.user_id }),
    });
  } catch {
    /* optional bridge */
  }

  return result;
}
