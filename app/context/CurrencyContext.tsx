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
import type { DisplayCurrency } from "../lib/formatPrice";

export type { DisplayCurrency };

const STORAGE_KEY = "illucards-currency";

type CurrencyContextValue = {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  hydrated: boolean;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>("BYN");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "RUB" || raw === "BYN") {
        setCurrencyState(raw);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, currency);
    } catch {
      /* ignore */
    }
  }, [currency, hydrated]);

  const setCurrency = useCallback((c: DisplayCurrency) => {
    setCurrencyState(c);
  }, []);

  const value = useMemo(
    () => ({ currency, setCurrency, hydrated }),
    [currency, setCurrency, hydrated]
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return ctx;
}
