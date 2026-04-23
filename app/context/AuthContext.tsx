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

const STORAGE_USERS = "illucards_users";
const STORAGE_SESSION = "illucards_session";
const STORAGE_GUEST_EMAIL = "illucards_guest_email";

export type AuthUser = {
  id: string;
  email: string;
  /** Демо-баллы для UI */
  bonusPoints: number;
};

type StoredUser = AuthUser & { password: string };

type AuthContextValue = {
  user: AuthUser | null;
  hydrated: boolean;
  guestEmail: string | null;
  setGuestEmail: (email: string) => void;
  register: (email: string, password: string) => { ok: true } | { ok: false; error: string };
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
      login,
      logout,
    }),
    [user, hydrated, guestEmail, setGuestEmail, register, login, logout]
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
