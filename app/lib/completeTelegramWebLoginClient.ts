import { apiUrl } from "@/app/lib/apiUrl";
import { isValidLoginWaitId } from "@/app/lib/telegramLoginWaitKeys";
import type { LoginWaitProfile } from "@/app/lib/telegramLoginWaitStore";
import {
  persistTelegramUserIdentity,
  readTelegramPrimaryUserId,
  readTelegramUserLink,
} from "@/app/lib/telegramUserIdentity";

export type CompleteTelegramWebLoginResult =
  | { ok: true; user_id: number; username: string | null }
  | { ok: false; error: string; status: number };

type EstablishSession = (
  telegramUserId: number,
  options?: { telegramUsername?: string | null },
) => { ok: true } | { ok: false; error: string };

export type LoginWaitPollResult = {
  ready: boolean;
  user_id?: number;
  username?: string | null;
};

const LOGIN_FETCH_TIMEOUT_MS = 12_000;

async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = LOGIN_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function applyTelegramLoginOnClient(
  userId: number,
  username: string | null,
  establishSessionFromTelegramUserId: EstablishSession,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const established = establishSessionFromTelegramUserId(userId, {
    telegramUsername: username,
  });
  if (!established.ok) return established;

  persistTelegramUserIdentity(userId, username);

  try {
    await fetch(apiUrl("/api/auth/telegram-cookie"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
  } catch {
    /* optional bridge */
  }

  return { ok: true };
}

async function recoverLoginFromExistingIdentity(
  establishSessionFromTelegramUserId: EstablishSession,
): Promise<CompleteTelegramWebLoginResult | null> {
  const existingId = readTelegramPrimaryUserId();
  if (existingId == null) return null;

  try {
    const stateRes = await fetch(apiUrl("/api/user-state"), {
      credentials: "include",
      cache: "no-store",
    });
    if (stateRes.ok) {
      const st = (await stateRes.json()) as { telegram_username?: unknown };
      const username =
        typeof st.telegram_username === "string"
          ? st.telegram_username.replace(/^@/, "").trim()
          : readTelegramUserLink()?.username ?? null;
      const applied = await applyTelegramLoginOnClient(
        existingId,
        username,
        establishSessionFromTelegramUserId,
      );
      if (!applied.ok) return null;
      return { ok: true, user_id: existingId, username };
    }
  } catch {
    /* ignore */
  }

  const link = readTelegramUserLink();
  if (link?.user_id === existingId) {
    const applied = await applyTelegramLoginOnClient(
      existingId,
      link.username || null,
      establishSessionFromTelegramUserId,
    );
    if (!applied.ok) return null;
    return { ok: true, user_id: existingId, username: link.username || null };
  }

  return null;
}

/** Опрос статуса wait_id (ready + профиль, если бот уже подтвердил). */
export async function pollLoginWait(
  waitId: string,
): Promise<LoginWaitPollResult> {
  const id = waitId.trim().toLowerCase();
  if (!isValidLoginWaitId(id)) return { ready: false };
  try {
    const res = await fetchWithTimeout(
      apiUrl(
        `/api/telegram-login-wait?wait_id=${encodeURIComponent(id)}&_=${Date.now()}`,
      ),
      { cache: "no-store", credentials: "same-origin" },
    );
    if (!res.ok) return { ready: false };
    const data = (await res.json()) as {
      ready?: boolean;
      user_id?: number;
      username?: string | null;
    };
    const uid = data.user_id;
    return {
      ready: Boolean(data.ready),
      user_id:
        typeof uid === "number" && Number.isFinite(uid) && uid > 0
          ? Math.floor(uid)
          : undefined,
      username:
        typeof data.username === "string" && data.username.trim()
          ? data.username.trim().replace(/^@/, "")
          : null,
    };
  } catch {
    return { ready: false };
  }
}

/** Ждём подтверждения в боте. */
export async function waitForLoginWaitReady(
  waitId: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<LoginWaitProfile | null> {
  const id = waitId.trim().toLowerCase();
  if (!isValidLoginWaitId(id)) return null;
  const timeoutMs = options?.timeoutMs ?? 45_000;
  const intervalMs = options?.intervalMs ?? 1000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const poll = await pollLoginWait(id);
    if (poll.ready && poll.user_id != null && poll.user_id > 0) {
      return {
        user_id: poll.user_id,
        username: poll.username ?? undefined,
      };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
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
    const res = await fetchWithTimeout(apiUrl("/api/telegram-login-wait/complete"), {
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
  options?: { knownProfile?: LoginWaitProfile | null },
): Promise<CompleteTelegramWebLoginResult> {
  const knownProfile = options?.knownProfile ?? null;

  const result = await completeTelegramWebLogin(waitId);
  if (result.ok) {
    const applied = await applyTelegramLoginOnClient(
      result.user_id,
      result.username,
      establishSessionFromTelegramUserId,
    );
    if (!applied.ok) {
      return { ok: false, error: applied.error, status: 400 };
    }
    return result;
  }

  if (knownProfile && knownProfile.user_id > 0) {
    const applied = await applyTelegramLoginOnClient(
      knownProfile.user_id,
      knownProfile.username ?? null,
      establishSessionFromTelegramUserId,
    );
    if (applied.ok) {
      return {
        ok: true,
        user_id: knownProfile.user_id,
        username: knownProfile.username ?? null,
      };
    }
  }

  if (result.status === 401) {
    const recovered = await recoverLoginFromExistingIdentity(
      establishSessionFromTelegramUserId,
    );
    if (recovered) return recovered;
  }

  return result;
}

/** Куда перенаправлять после успешного автовхода. */
export function accountUrlAfterTelegramLogin(): string {
  if (typeof window === "undefined") return "/account";
  return `${window.location.origin}/account`;
}
