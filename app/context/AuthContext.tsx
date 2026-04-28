"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearTelegramUserIdentity,
  persistTelegramUserIdentity,
  readTelegramPrimaryUserId,
  syncTelegramIdentityFromSession,
} from "@/app/lib/telegramUserIdentity";

const STORAGE_USERS = "illucards_users";
const STORAGE_SESSION = "illucards_session";
const STORAGE_GUEST_EMAIL = "illucards_guest_email";
const STORAGE_TG_FLAG = "illucards_tg_logged_in";

export type AuthUser = {
  id: string;
  /** Для Telegram: синтетический адрес tg_{id}@illucards.local; для email-аккаунта — обычный email */
  email: string;
  bonusPoints: number;
  /** Основной идентификатор для пользователей Telegram (= user_id в API Telegram) */
  telegramId?: number;
  telegramUsername?: string | null;
  firstName?: string | null;
};

type StoredUser = AuthUser & { password: string };

type AuthContextValue = {
  user: AuthUser | null;
  hydrated: boolean;
  guestEmail: string | null;
  setGuestEmail: (email: string) => void;
  /** Создаёт или поднимает локального пользователя по Telegram id (в т.ч. из `?user_id=`). */
  establishSessionFromTelegramUserId: (
    telegramUserId: number,
    options?: { telegramUsername?: string | null }
  ) => { ok: true } | { ok: false; error: string };
  logout: () => void;
  /** Telegram user id (как `telegram_user_id` в storage), основной id для сайта и бота */
  primaryTelegramUserId: number | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_USERS);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? (p as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
}

function readSession(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_SESSION);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function writeSession(user: AuthUser | null) {
  if (user) {
    localStorage.setItem(STORAGE_SESSION, JSON.stringify(user));
    if (user.telegramId != null && Number.isFinite(user.telegramId) && user.telegramId > 0) {
      persistTelegramUserIdentity(user.telegramId, user.telegramUsername);
      try {
        localStorage.setItem(STORAGE_TG_FLAG, "1");
      } catch {
        /* ignore */
      }
    } else {
      clearTelegramUserIdentity();
      try {
        localStorage.removeItem(STORAGE_TG_FLAG);
      } catch {
        /* ignore */
      }
    }
  } else {
    localStorage.removeItem(STORAGE_SESSION);
    clearTelegramUserIdentity();
    try {
      localStorage.removeItem(STORAGE_TG_FLAG);
    } catch {
      /* ignore */
    }
  }
}

function telegramSyntheticEmail(telegramId: number): string {
  return `tg_${telegramId}@illucards.local`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [guestEmail, setGuestEmailState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const session = readSession();
    setUser(session);
    if (session?.telegramId) {
      syncTelegramIdentityFromSession(
        session.telegramId,
        session.telegramUsername,
      );
    } else {
      clearTelegramUserIdentity();
    }
    try {
      const g = localStorage.getItem(STORAGE_GUEST_EMAIL);
      setGuestEmailState(g?.trim() || null);
    } catch {
      setGuestEmailState(null);
    }
    setHydrated(true);
  }, []);

  const setGuestEmail = useCallback((email: string) => {
    const t = email.trim();
    if (t) {
      localStorage.setItem(STORAGE_GUEST_EMAIL, t);
      setGuestEmailState(t);
    }
  }, []);

  const establishSessionFromTelegramUserId = useCallback(
    (
      telegramUserId: number,
      options?: { telegramUsername?: string | null },
    ): { ok: true } | { ok: false; error: string } => {
      if (!Number.isFinite(telegramUserId) || telegramUserId <= 0) {
        return { ok: false, error: "Некорректный идентификатор пользователя." };
      }
      const tgName =
        typeof options?.telegramUsername === "string" &&
        options.telegramUsername.trim()
          ? options.telegramUsername.trim().replace(/^@/, "")
          : null;
      const users = readUsers();
      let found = users.find((u) => u.telegramId === telegramUserId);
      if (!found) {
        const email = telegramSyntheticEmail(telegramUserId);
        const newUser: StoredUser = {
          id: crypto.randomUUID(),
          email,
          password: crypto.randomUUID(),
          bonusPoints: 0,
          telegramId: telegramUserId,
          telegramUsername: tgName,
          firstName: tgName ? `@${tgName}` : "Пользователь",
        };
        users.push(newUser);
        writeUsers(users);
        found = newUser;
      } else if (found && tgName) {
        const existing = found;
        const updated: StoredUser = {
          ...existing,
          telegramUsername: tgName,
          firstName:
            existing.firstName && existing.firstName !== "Пользователь"
              ? existing.firstName
              : `@${tgName}`,
        };
        const idx = users.findIndex((u) => u.id === existing.id);
        if (idx >= 0) {
          users[idx] = updated;
          writeUsers(users);
        }
        found = updated;
      }
      const { password, ...session } = found;
      void password;
      setUser(session);
      writeSession(session);
      localStorage.removeItem(STORAGE_GUEST_EMAIL);
      setGuestEmailState(null);
      return { ok: true };
    },
    [],
  );

  const logout = useCallback(() => {
    setUser(null);
    writeSession(null);
    try {
      localStorage.removeItem("user_id");
      localStorage.removeItem(STORAGE_TG_FLAG);
    } catch {
      /* ignore */
    }
  }, []);

  const primaryTelegramUserId = useMemo((): number | null => {
    if (user?.telegramId != null && Number.isFinite(user.telegramId) && user.telegramId > 0) {
      return user.telegramId;
    }
    return readTelegramPrimaryUserId();
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      hydrated,
      guestEmail,
      setGuestEmail,
      establishSessionFromTelegramUserId,
      logout,
      primaryTelegramUserId,
    }),
    [
      user,
      hydrated,
      guestEmail,
      setGuestEmail,
      establishSessionFromTelegramUserId,
      logout,
      primaryTelegramUserId,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth вне AuthProvider");
  }
  return ctx;
}

/** Email для чека: сначала аккаунт, иначе гость */
export function useCheckoutEmail(): string | null {
  const { user, guestEmail } = useAuth();
  return user?.email?.trim() || guestEmail?.trim() || null;
}
