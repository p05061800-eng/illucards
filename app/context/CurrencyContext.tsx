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
import { normalizeDeliveryCountry } from "../lib/delivery";

export type { DisplayCurrency };

const STORAGE_KEY = "illucards-currency";
const PROMPT_ANSWERED_STORAGE_KEY = "illucards-currency-prompt-answered";
/** Тот же ключ, что в CartContext — валюта витрины следует стране доставки. */
const DELIVERY_STORAGE_KEY = "illucards-delivery-country";

type CurrencyContextValue = {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  hydrated: boolean;
  needsCurrencyPrompt: boolean;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>("BYN");
  const [hydrated, setHydrated] = useState(false);
  const [needsCurrencyPrompt, setNeedsCurrencyPrompt] = useState(false);

  useEffect(() => {
    try {
      const d = normalizeDeliveryCountry(localStorage.getItem(DELIVERY_STORAGE_KEY));
      if (d === "RU" || d === "UA" || d === "OTHER") {
        setCurrencyState("RUB");
      } else if (d === "BY") {
        setCurrencyState("BYN");
      } else {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === "RUB" || raw === "BYN") {
          setCurrencyState(raw);
        }
        if (localStorage.getItem(PROMPT_ANSWERED_STORAGE_KEY) !== "1") {
          setNeedsCurrencyPrompt(true);
        }
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
    setNeedsCurrencyPrompt(false);
    try {
      localStorage.setItem(PROMPT_ANSWERED_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ currency, setCurrency, hydrated, needsCurrencyPrompt }),
    [currency, setCurrency, hydrated, needsCurrencyPrompt]
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
