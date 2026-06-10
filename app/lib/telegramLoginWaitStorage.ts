import {
  TG_LOGIN_WAIT_STORAGE_KEY,
  isValidLoginWaitId,
} from "@/app/lib/telegramLoginWaitKeys";

const WAIT_TTL_MS = 10 * 60 * 1000;

export const TG_LOGIN_WAIT_STARTED_EVENT = "illucards:tg-login-wait-started";

type StoredWait = {
  id: string;
  at: number;
};

function parseStoredWait(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (isValidLoginWaitId(trimmed)) return trimmed.toLowerCase();
  try {
    const j = JSON.parse(trimmed) as StoredWait;
    const id = typeof j.id === "string" ? j.id.trim() : "";
    const at = typeof j.at === "number" && Number.isFinite(j.at) ? j.at : 0;
    if (!isValidLoginWaitId(id)) return null;
    if (Date.now() - at > WAIT_TTL_MS) return null;
    return id.toLowerCase();
  } catch {
    return null;
  }
}

/** Сохранить wait_id в sessionStorage + localStorage (переживает suspend вкладки). */
export function persistLoginWaitId(waitId: string): void {
  const id = waitId.trim().toLowerCase();
  if (!isValidLoginWaitId(id)) return;
  const payload = JSON.stringify({ id, at: Date.now() } satisfies StoredWait);
  try {
    sessionStorage.setItem(TG_LOGIN_WAIT_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(TG_LOGIN_WAIT_STORAGE_KEY, payload);
  } catch {
    /* ignore */
  }
}

/** Прочитать активный wait_id (sessionStorage → localStorage). */
export function readLoginWaitId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromSession = parseStoredWait(
      sessionStorage.getItem(TG_LOGIN_WAIT_STORAGE_KEY),
    );
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  try {
    const fromLocal = parseStoredWait(localStorage.getItem(TG_LOGIN_WAIT_STORAGE_KEY));
    if (fromLocal) {
      try {
        sessionStorage.setItem(TG_LOGIN_WAIT_STORAGE_KEY, fromLocal);
      } catch {
        /* ignore */
      }
      return fromLocal;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function clearLoginWaitId(): void {
  try {
    sessionStorage.removeItem(TG_LOGIN_WAIT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(TG_LOGIN_WAIT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function notifyLoginWaitStarted(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TG_LOGIN_WAIT_STARTED_EVENT));
}
