"use client";

/**
 * Корзина: позиции с ценой в BYN и в RUB (руб. из карточки или × курс).
 * Итого для оплаты — всегда в BYN (`totalPriceByn`).
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
import type { CardRarity, StoredCard } from "../api/cards/route";
import { cardTreatsAsAdultPricing } from "../lib/cardRarityTags";
import { deliveryCharge } from "../lib/delivery";
import type { DeliveryCountry } from "../lib/delivery";
import {
  ADULT_FIXED_PRICE_BYN,
  ADULT_FIXED_PRICE_RUB,
  rubFromByn,
} from "../lib/formatPrice";

export type CartLine = {
  id: string;
  title: string;
  /** Цена за единицу в бел. руб. */
  priceByn: number;
  /** Цена за единицу в руб. РФ (для витрины). */
  priceRub: number;
  frontImage: string;
  /** Для эталонных размеров next/image (Marvel / Stranger Things и т.д.) */
  category?: string;
  /** Порядок в категории (сортировка / подсказки; 18+ только по `rarity: "adult"`). */
  categoryOrder?: number;
  /** Для размытия 18+ в корзине до подтверждения возраста. */
  rarity?: CardRarity;
  quantity: number;
};

/** Ключ записи корзины в `localStorage` */
export const CART_STORAGE_KEY = "illucards-cart";
const STORAGE_KEY = CART_STORAGE_KEY;
const DELIVERY_STORAGE_KEY = "illucards-delivery-country";

function loadDeliveryCountry(): DeliveryCountry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DELIVERY_STORAGE_KEY);
    if (raw === "BY" || raw === "RU" || raw === "UA" || raw === "OTHER") {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

/** В строке корзины: `adult`, если у карточки есть метка 18+ — для размытия миниатюры. */
function cartLineRarityForStorage(card: StoredCard): CardRarity {
  return cardTreatsAsAdultPricing(card) ? "adult" : card.rarity;
}

function lineFromCard(card: StoredCard): Pick<CartLine, "priceByn" | "priceRub"> {
  if (cardTreatsAsAdultPricing(card)) {
    return { priceByn: ADULT_FIXED_PRICE_BYN, priceRub: ADULT_FIXED_PRICE_RUB };
  }
  const priceByn = Number.isFinite(card.price) ? card.price : 0;
  const priceRub =
    card.priceRub != null && Number.isFinite(card.priceRub)
      ? Math.round(card.priceRub)
      : rubFromByn(priceByn);
  return { priceByn, priceRub };
}

function normalizeLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const out: CartLine[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const title = typeof o.title === "string" ? o.title : "";
    const frontImage =
      typeof o.frontImage === "string" ? o.frontImage : "";
    const category =
      typeof o.category === "string" ? o.category.trim() : undefined;
    const co = o.categoryOrder;
    const categoryOrder =
      typeof co === "number" && Number.isFinite(co) ? co : undefined;
    const rarityRaw = typeof o.rarity === "string" ? o.rarity.trim() : "";
    const rarity =
      rarityRaw === "adult" ||
      rarityRaw === "common" ||
      rarityRaw === "limited" ||
      rarityRaw === "replica" ||
      rarityRaw === "novelty" ||
      rarityRaw === "hot_price"
        ? (rarityRaw as CardRarity)
        : undefined;
    const q = typeof o.quantity === "number" ? o.quantity : Number(o.quantity);
    const quantity = Number.isFinite(q) && q >= 1 ? Math.floor(q) : 1;
    if (!id) continue;

    let priceByn: number;
    let priceRub: number;
    if (typeof o.priceByn === "number" && Number.isFinite(o.priceByn)) {
      priceByn = o.priceByn;
      priceRub =
        typeof o.priceRub === "number" && Number.isFinite(o.priceRub)
          ? o.priceRub
          : rubFromByn(priceByn);
    } else if (typeof o.price === "number" && Number.isFinite(o.price)) {
      priceByn = o.price;
      priceRub = rubFromByn(priceByn);
    } else {
      continue;
    }

    if (rarity === "adult") {
      priceByn = ADULT_FIXED_PRICE_BYN;
      priceRub = ADULT_FIXED_PRICE_RUB;
    }

    out.push({
      id,
      title,
      priceByn,
      priceRub,
      frontImage,
      ...(category ? { category } : {}),
      ...(categoryOrder != null ? { categoryOrder } : {}),
      ...(rarity ? { rarity } : {}),
      quantity,
    });
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
  cartItems: CartLine[];
  hydrated: boolean;
  itemCount: number;
  /** Сумма в бел. руб. */
  totalPriceByn: number;
  /** Сумма в руб. РФ (по ценам на витрине). */
  totalPriceRub: number;
  /** Выбранная страна доставки (null — не выбрана). */
  deliveryCountry: DeliveryCountry | null;
  setDeliveryCountry: (country: DeliveryCountry | null) => void;
  /** Доставка в BYN (0, если страна не выбрана). */
  deliveryPriceByn: number;
  /** Доставка в RUB (0, если страна не выбрана). */
  deliveryPriceRub: number;
  /** Товары + доставка, BYN. */
  orderTotalByn: number;
  /** Товары + доставка, RUB. */
  orderTotalRub: number;
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
  const [deliveryCountry, setDeliveryCountryState] =
    useState<DeliveryCountry | null>(null);

  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const toggleCart = useCallback(() => setCartOpen((o) => !o), []);

  useEffect(() => {
    setCartItems(loadFromStorage());
    setDeliveryCountryState(loadDeliveryCountry());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (deliveryCountry) {
        localStorage.setItem(DELIVERY_STORAGE_KEY, deliveryCountry);
      } else {
        localStorage.removeItem(DELIVERY_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [deliveryCountry, hydrated]);

  const setDeliveryCountry = useCallback((country: DeliveryCountry | null) => {
    setDeliveryCountryState(country);
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
    const { priceByn, priceRub } = lineFromCard(card);
    setCartItems((prev) => {
      const i = prev.findIndex((l) => l.id === card.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = {
          ...next[i],
          quantity: next[i].quantity + 1,
          priceByn,
          priceRub,
          rarity: cartLineRarityForStorage(card),
        };
        return next;
      }
      return [
        ...prev,
        {
          id: card.id,
          title: card.title,
          priceByn,
          priceRub,
          frontImage: card.frontImage,
          category: card.category,
          categoryOrder: card.categoryOrder,
          rarity: cartLineRarityForStorage(card),
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

  const totalPriceByn = useMemo(
    () =>
      cartItems.reduce((s, l) => s + l.priceByn * l.quantity, 0),
    [cartItems]
  );

  const totalPriceRub = useMemo(
    () =>
      cartItems.reduce((s, l) => s + l.priceRub * l.quantity, 0),
    [cartItems]
  );

  const deliveryPriceByn = useMemo(() => {
    if (!deliveryCountry) return 0;
    return deliveryCharge(deliveryCountry).amountByn;
  }, [deliveryCountry]);

  const deliveryPriceRub = useMemo(() => {
    if (!deliveryCountry) return 0;
    return deliveryCharge(deliveryCountry).amountRub;
  }, [deliveryCountry]);

  const orderTotalByn = useMemo(
    () =>
      Math.round((totalPriceByn + deliveryPriceByn) * 100) / 100,
    [totalPriceByn, deliveryPriceByn]
  );

  const orderTotalRub = useMemo(
    () => totalPriceRub + deliveryPriceRub,
    [totalPriceRub, deliveryPriceRub]
  );

  const value = useMemo(
    () => ({
      cartItems,
      hydrated,
      itemCount,
      totalPriceByn,
      totalPriceRub,
      deliveryCountry,
      setDeliveryCountry,
      deliveryPriceByn,
      deliveryPriceRub,
      orderTotalByn,
      orderTotalRub,
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
      totalPriceByn,
      totalPriceRub,
      deliveryCountry,
      setDeliveryCountry,
      deliveryPriceByn,
      deliveryPriceRub,
      orderTotalByn,
      orderTotalRub,
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
