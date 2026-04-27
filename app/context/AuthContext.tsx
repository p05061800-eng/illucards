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
import type { TelegramVerifiedProfile } from "@/app/lib/telegramAuth";

const STORAGE_USERS = "illucards_users";
const STORAGE_SESSION = "illucards_session";
const STORAGE_GUEST_EMAIL = "illucards_guest_email";

export type AuthUser = {
  id: string;
  /** Для Telegram: синтетический адрес tg_{id}@illucards.local; для email-аккаунта — обычный email */
  email: string;
  bonusPoints: number;
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
  register: (email: string, password: string) => { ok: true } | { ok: false; error: string };
  registerWithTelegram: (
    profile: TelegramVerifiedProfile
  ) => { ok: true } | { ok: false; error: string };
  loginWithTelegram: (
    profile: TelegramVerifiedProfile
  ) => { ok: true } | { ok: false; error: string };
  login: (email: string, password: string) => { ok: true } | { ok: false; error: string };
  logout: () => void;
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
  } else {
    localStorage.removeItem(STORAGE_SESSION);
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
    setUser(readSession());
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

  const register = useCallback(
    (email: string, password: string): { ok: true } | { ok: false; error: string } => {
      const e = email.trim().toLowerCase();
      if (!e || !password || password.length < 4) {
        return { ok: false, error: "Укажите email и пароль не короче 4 символов." };
      }
      if (e.endsWith("@illucards.local")) {
        return { ok: false, error: "Регистрация только через Telegram." };
      }
      const users = readUsers();
      if (users.some((u) => u.email.toLowerCase() === e)) {
        return { ok: false, error: "Этот email уже зарегистрирован." };
      }
      const newUser: StoredUser = {
        id: crypto.randomUUID(),
        email: e,
        password,
        bonusPoints: 0,
      };
      users.push(newUser);
      writeUsers(users);
      const { password: _, ...session } = newUser;
      setUser(session);
      writeSession(session);
      localStorage.removeItem(STORAGE_GUEST_EMAIL);
      setGuestEmailState(null);
      return { ok: true };
    },
    []
  );

  const registerWithTelegram = useCallback(
    (profile: TelegramVerifiedProfile): { ok: true } | { ok: false; error: string } => {
      const users = readUsers();
      if (users.some((u) => u.telegramId === profile.telegramId)) {
        return {
          ok: false,
          error: "Этот Telegram уже зарегистрирован. Войдите через Telegram.",
        };
      }
      const email = telegramSyntheticEmail(profile.telegramId);
      const newUser: StoredUser = {
        id: crypto.randomUUID(),
        email,
        password: crypto.randomUUID(),
        bonusPoints: 0,
        telegramId: profile.telegramId,
        telegramUsername: profile.username,
        firstName: profile.firstName,
      };
      users.push(newUser);
      writeUsers(users);
      const { password: _, ...session } = newUser;
      setUser(session);
      writeSession(session);
      localStorage.removeItem(STORAGE_GUEST_EMAIL);
      setGuestEmailState(null);
      return { ok: true };
    },
    []
  );

  const loginWithTelegram = useCallback(
    (profile: TelegramVerifiedProfile): { ok: true } | { ok: false; error: string } => {
      const users = readUsers();
      const found = users.find((u) => u.telegramId === profile.telegramId);
      if (!found) {
        return { ok: false, error: "Аккаунт не найден. Сначала зарегистрируйтесь через Telegram." };
      }
      const updated: StoredUser = {
        ...found,
        firstName: profile.firstName,
        telegramUsername: profile.username ?? found.telegramUsername ?? null,
      };
      const idx = users.findIndex((u) => u.id === found.id);
      if (idx >= 0) {
        users[idx] = updated;
        writeUsers(users);
      }
      const { password: _, ...session } = updated;
      setUser(session);
      writeSession(session);
      localStorage.removeItem(STORAGE_GUEST_EMAIL);
      setGuestEmailState(null);
      return { ok: true };
    },
    []
  );

  const login = useCallback(
    (email: string, password: string): { ok: true } | { ok: false; error: string } => {
      const e = email.trim().toLowerCase();
      const users = readUsers();
      const found = users.find(
        (u) => u.email.toLowerCase() === e && u.password === password
      );
      if (!found) {
        return { ok: false, error: "Неверный email или пароль." };
      }
      if (e.endsWith("@illucards.local") && found.telegramId) {
        return {
          ok: false,
          error: "Войдите через кнопку Telegram.",
        };
      }
      const { password: _, ...session } = found;
      setUser(session);
      writeSession(session);
      localStorage.removeItem(STORAGE_GUEST_EMAIL);
      setGuestEmailState(null);
      return { ok: true };
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    writeSession(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      hydrated,
      guestEmail,
      setGuestEmail,
      register,
      registerWithTelegram,
      loginWithTelegram,
      login,
      logout,
    }),
    [
      user,
      hydrated,
      guestEmail,
      setGuestEmail,
      register,
      registerWithTelegram,
      loginWithTelegram,
      login,
      logout,
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
