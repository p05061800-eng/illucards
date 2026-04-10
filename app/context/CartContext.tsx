"use client";

/**
 * Корзина: `cartItems`, добавление, `removeFromCart`, `setQuantity`, `totalPrice`.
 * После гидрации состояние сохраняется в `localStorage` под ключом `CART_STORAGE_KEY`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { StoredCard } from "../api/cards/route";

export type CartLine = {
  id: string;
  title: string;
  price: number;
  frontImage: string;
  quantity: number;
};

/** Ключ записи корзины в `localStorage` */
export const CART_STORAGE_KEY = "illucards-cart";
const STORAGE_KEY = CART_STORAGE_KEY;

function normalizeLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const out: CartLine[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const title = typeof o.title === "string" ? o.title : "";
    const price = typeof o.price === "number" ? o.price : Number(o.price);
    const frontImage =
      typeof o.frontImage === "string" ? o.frontImage : "";
    const q = typeof o.quantity === "number" ? o.quantity : Number(o.quantity);
    const quantity = Number.isFinite(q) && q >= 1 ? Math.floor(q) : 1;
    if (!id || !Number.isFinite(price)) continue;
    out.push({ id, title, price, frontImage, quantity });
  }
  return out;
}

function loadFromStorage(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizeLines(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

type CartContextValue = {
  /** Позиции корзины (синхронизируются с localStorage после гидрации) */
  cartItems: CartLine[];
  hydrated: boolean;
  itemCount: number;
  totalPrice: number;
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addToCart: (card: StoredCard) => void;
  removeFromCart: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const toggleCart = useCallback(() => setCartOpen((o) => !o), []);

  useEffect(() => {
    setCartItems(loadFromStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
    } catch {
      /* ignore quota */
    }
  }, [cartItems, hydrated]);

  const addToCart = useCallback((card: StoredCard) => {
    setCartItems((prev) => {
      const i = prev.findIndex((l) => l.id === card.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = {
          ...next[i],
          quantity: next[i].quantity + 1,
        };
        return next;
      }
      return [
        ...prev,
        {
          id: card.id,
          title: card.title,
          price: card.price,
          frontImage: card.frontImage,
          quantity: 1,
        },
      ];
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCartItems((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const setQuantity = useCallback((id: string, quantity: number) => {
    const q = Math.floor(quantity);
    if (q < 1) {
      setCartItems((prev) => prev.filter((l) => l.id !== id));
      return;
    }
    setCartItems((prev) =>
      prev.map((l) => (l.id === id ? { ...l, quantity: q } : l))
    );
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const itemCount = useMemo(
    () => cartItems.reduce((s, l) => s + l.quantity, 0),
    [cartItems]
  );

  const totalPrice = useMemo(
    () =>
      cartItems.reduce(
        (s, l) => s + l.price * l.quantity,
        0
      ),
    [cartItems]
  );

  const value = useMemo(
    () => ({
      cartItems,
      hydrated,
      itemCount,
      totalPrice,
      cartOpen,
      openCart,
      closeCart,
      toggleCart,
      addToCart,
      removeFromCart,
      setQuantity,
      clearCart,
    }),
    [
      cartItems,
      hydrated,
      itemCount,
      totalPrice,
      cartOpen,
      openCart,
      closeCart,
      toggleCart,
      addToCart,
      removeFromCart,
      setQuantity,
      clearCart,
    ]
  );

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}
