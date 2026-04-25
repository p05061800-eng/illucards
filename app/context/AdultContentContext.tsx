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

const STORAGE_KEY = "illucards-adult-confirmed-ids-v2";

function loadIdsFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export type AdultContentContextValue = {
  isAdultConfirmed: (cardId: string) => boolean;
  confirmAdultForCard: (cardId: string) => void;
};

const AdultContentContext = createContext<AdultContentContextValue | null>(
  null,
);

export function AdultContentProvider({ children }: { children: ReactNode }) {
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : loadIdsFromStorage(),
  );

  useEffect(() => {
    setConfirmedIds(loadIdsFromStorage());
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setConfirmedIds(loadIdsFromStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isAdultConfirmed = useCallback(
    (cardId: string) => confirmedIds.has(cardId),
    [confirmedIds],
  );

  const confirmAdultForCard = useCallback((cardId: string) => {
    const id = cardId.trim();
    if (!id) return;
    setConfirmedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ isAdultConfirmed, confirmAdultForCard }),
    [isAdultConfirmed, confirmAdultForCard],
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
