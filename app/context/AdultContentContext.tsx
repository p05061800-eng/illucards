"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "illucards-adult-confirmed-ids-v3";
const LEGACY_STORAGE_KEYS = [
  "illucards-adult-confirmed-ids-v2",
  "illucards-adult-confirmed-ids",
] as const;

function parseIdArray(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

/** Читает v3, иначе переносит id из старых ключей в v3 (один раз). */
function loadIdsFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const current = parseIdArray(localStorage.getItem(STORAGE_KEY));
    if (current.size > 0) return current;

    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      const fromLegacy = parseIdArray(localStorage.getItem(legacyKey));
      if (fromLegacy.size > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...fromLegacy]));
        return fromLegacy;
      }
    }
    return new Set();
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
  /** Пустой на SSR и первом кадре клиента — совпадает с гидрацией; сразу подставляем LS в useLayoutEffect. */
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(
    () => new Set(),
  );

  useLayoutEffect(() => {
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
