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

const STORAGE_KEY = "illucards-adult-content-confirmed-v1";

export type AdultContentContextValue = {
  /** Пользователь нажал «Мне есть 18 лет» (сохранено в localStorage). */
  confirmed: boolean;
  confirmAdult: () => void;
};

const AdultContentContext = createContext<AdultContentContextValue | null>(
  null,
);

export function AdultContentProvider({ children }: { children: ReactNode }) {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setConfirmed(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setConfirmed(e.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const confirmAdult = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setConfirmed(true);
  }, []);

  const value = useMemo(
    () => ({ confirmed, confirmAdult }),
    [confirmed, confirmAdult],
  );

  return (
    <AdultContentContext.Provider value={value}>
      {children}
    </AdultContentContext.Provider>
  );
}

export function useAdultContentGateOptional(): AdultContentContextValue | null {
  return useContext(AdultContentContext);
}
