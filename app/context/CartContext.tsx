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
import {
  cardTreatsAsAdultPricing,
  parseCardRarity,
} from "../lib/cardRarityTags";
import { bonusDiscountByn, maxSpendableBonusPoints } from "../lib/bonusProgram";
import { deliveryCharge } from "../lib/delivery";
import { normalizeDeliveryCountry, type DeliveryCountry } from "../lib/delivery";
import {
  ADULT_FIXED_PRICE_BYN,
  ADULT_FIXED_PRICE_RUB,
  displayCurrencyForDelivery,
  rubFromByn,
} from "../lib/formatPrice";
import { apiUrl } from "../lib/apiUrl";
import { readTelegramPrimaryUserId } from "../lib/telegramUserIdentity";
import { useCurrency } from "./CurrencyContext";

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
/** Последний `updatedAt` с сервера (`/api/user-state`) — для согласования после очистки корзины при подтверждении заказа в боте. */
const USER_STATE_SYNC_AT_KEY = "illucards-user-state-updated-at";

function readClientSeenServerUpdatedAt(): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = Number(localStorage.getItem(USER_STATE_SYNC_AT_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

function writeClientSeenServerUpdatedAt(ts: number): void {
  if (typeof window === "undefined" || !Number.isFinite(ts) || ts <= 0) return;
  try {
    localStorage.setItem(USER_STATE_SYNC_AT_KEY, String(Math.floor(ts)));
  } catch {
    /* ignore */
  }
}

function loadDeliveryCountry(): DeliveryCountry | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeDeliveryCountry(localStorage.getItem(DELIVERY_STORAGE_KEY));
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
  /**
   * Повтор заказа: добавить позиции в корзину (совпадающие id — суммируем quantity),
   * опционально выставить страну доставки. Обложка из заказа, иначе заглушка.
   */
  repeatOrderToCart: (
    lines: Array<{
      id: string;
      title: string;
      quantity: number;
      priceByn: number;
      priceRub: number;
      frontImage?: string;
      category?: string;
      rarity?: string;
    }>,
    options?: {
      deliveryCountry?: DeliveryCountry | null;
      /** По умолчанию false — удобно перед переходом на /checkout */
      openCart?: boolean;
    },
  ) => void;
  /** Баллы на счёте (с сервера). */
  bonusBalance: number;
  /** Сколько баллов списать в этом заказе. */
  bonusSpendPoints: number;
  setBonusSpendPoints: (points: number) => void;
  /** Максимум баллов к списанию при текущей корзине и доставке. */
  maxBonusSpendPoints: number;
  /** Скидка в BYN от выбранных баллов. */
  bonusDiscountByn: number;
  /** Итого к оплате после бонусов (BYN). */
  checkoutTotalByn: number;
  /** Итого после бонусов для отображения в RUB (доставка не BY). */
  checkoutTotalRub: number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [deliveryCountry, setDeliveryCountryState] =
    useState<DeliveryCountry | null>(null);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [bonusSpendPoints, setBonusSpendPointsState] = useState(0);
  const { currency, setCurrency, hydrated: currencyHydrated } = useCurrency();

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

  /**
   * Страна доставки задаёт валюту глобально, пока выбрана (в т.ч. после ручного BYN/RUB в шапке).
   * Без страны — переключатель в шапке сам по себе (каталог).
   */
  useEffect(() => {
    if (!hydrated || !currencyHydrated) return;
    if (deliveryCountry == null) return;
    const want =
      deliveryCountry === "BY" ? "BYN" : "RUB";
    if (currency !== want) {
      setCurrency(want);
    }
  }, [
    deliveryCountry,
    currency,
    hydrated,
    currencyHydrated,
    setCurrency,
  ]);

  const setDeliveryCountry = useCallback((country: DeliveryCountry | null) => {
    setDeliveryCountryState(country);
    if (country == null) setBonusSpendPointsState(0);
  }, []);

  const setBonusSpendPoints = useCallback((points: number) => {
    const p = Math.max(0, Math.floor(Number(points) || 0));
    setBonusSpendPointsState(p);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
    } catch {
      /* ignore quota */
    }
  }, [cartItems, hydrated]);

  const applyServerCartIfClearedElsewhere = useCallback(async () => {
    const userId = readTelegramPrimaryUserId();
    if (userId == null) return;
    try {
      const res = await fetch(apiUrl("/api/user-state"), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        cart?: unknown[];
        updatedAt?: unknown;
        bonus_points?: unknown;
      };
      const ts =
        typeof data.updatedAt === "number" && Number.isFinite(data.updatedAt)
          ? data.updatedAt
          : 0;
      const cart = Array.isArray(data.cart) ? data.cart : [];
      const bp =
        typeof data.bonus_points === "number" && Number.isFinite(data.bonus_points)
          ? Math.max(0, Math.floor(data.bonus_points))
          : 0;
      if (ts > 0) {
        writeClientSeenServerUpdatedAt(ts);
      }
      setBonusBalance(bp);
      if (ts > 0 && cart.length === 0) {
        setCartItems([]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const userId = readTelegramPrimaryUserId();
    if (userId == null) return;
    void applyServerCartIfClearedElsewhere();
    const tick = window.setInterval(() => {
      void applyServerCartIfClearedElsewhere();
    }, 28000);
    const onVis = () => {
      if (document.visibilityState === "visible") void applyServerCartIfClearedElsewhere();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [hydrated, applyServerCartIfClearedElsewhere]);

  useEffect(() => {
    if (!hydrated) return;
    const userId = readTelegramPrimaryUserId();
    if (userId == null) return;
    const seen = readClientSeenServerUpdatedAt();
    void fetch(apiUrl("/api/user-state"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        ...(seen > 0 ? { client_seen_updated_at: seen } : {}),
        ...(deliveryCountry != null ? { delivery_country: deliveryCountry } : {}),
        ...(deliveryCountry != null
          ? { currency: displayCurrencyForDelivery(deliveryCountry) }
          : {}),
        cart: cartItems.map((x) => ({
          id: x.id,
          title: x.title,
          quantity: x.quantity,
          priceByn: x.priceByn,
          priceRub: x.priceRub,
        })),
      }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const j = (await res.json().catch(() => null)) as { updatedAt?: unknown } | null;
        const ua =
          j && typeof j === "object" && typeof j.updatedAt === "number" && Number.isFinite(j.updatedAt)
            ? j.updatedAt
            : NaN;
        if (ua > 0) writeClientSeenServerUpdatedAt(ua);
      })
      .catch(() => {});
  }, [cartItems, deliveryCountry, hydrated]);

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

  const PLACEHOLDER_IMAGE = "/file.svg";

  const repeatOrderToCart = useCallback(
    (
      lines: Array<{
        id: string;
        title: string;
        quantity: number;
        priceByn: number;
        priceRub: number;
        frontImage?: string;
        category?: string;
        rarity?: string;
      }>,
      options?: {
        deliveryCountry?: DeliveryCountry | null;
        openCart?: boolean;
      },
    ) => {
      const toAdd: CartLine[] = [];
      for (const l of lines) {
        const id = typeof l.id === "string" ? l.id.trim() : "";
        if (!id) continue;
        const title = typeof l.title === "string" ? l.title.trim() : "";
        if (!title) continue;
        const q = Math.max(1, Math.floor(Number(l.quantity) || 1));
        const priceByn = Number.isFinite(l.priceByn) ? l.priceByn : 0;
        const priceRub = Number.isFinite(l.priceRub) ? l.priceRub : rubFromByn(priceByn);
        const img =
          typeof l.frontImage === "string" && l.frontImage.trim()
            ? l.frontImage.trim()
            : PLACEHOLDER_IMAGE;
        const category =
          typeof l.category === "string" && l.category.trim()
            ? l.category.trim()
            : undefined;
        const rarity =
          typeof l.rarity === "string" && l.rarity.trim()
            ? parseCardRarity(l.rarity)
            : undefined;
        toAdd.push({
          id,
          title,
          priceByn,
          priceRub,
          frontImage: img,
          quantity: q,
          ...(category ? { category } : {}),
          ...(rarity ? { rarity } : {}),
        });
      }
      if (toAdd.length === 0) return;

      setCartItems((prev) => {
        const next = prev.map((x) => ({ ...x }));
        for (const l of toAdd) {
          const i = next.findIndex((x) => x.id === l.id);
          if (i >= 0) {
            next[i] = {
              ...next[i],
              quantity: next[i].quantity + l.quantity,
              priceByn: l.priceByn,
              priceRub: l.priceRub,
              title: l.title,
              frontImage:
                l.frontImage && l.frontImage !== PLACEHOLDER_IMAGE
                  ? l.frontImage
                  : next[i].frontImage,
              category: l.category ?? next[i].category,
              rarity: l.rarity ?? next[i].rarity,
            };
          } else {
            next.push(l);
          }
        }
        return next;
      });

      if (options?.deliveryCountry != null) {
        setDeliveryCountryState(options.deliveryCountry);
      }
      if (options?.openCart === true) {
        setCartOpen(true);
      } else {
        setCartOpen(false);
      }
    },
    [],
  );

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

  const bonusDiscountBynValue = useMemo(() => {
    if (!deliveryCountry) return 0;
    return bonusDiscountByn(bonusSpendPoints, deliveryCountry);
  }, [bonusSpendPoints, deliveryCountry]);

  const maxBonusSpendPointsValue = useMemo(() => {
    if (!deliveryCountry || bonusBalance <= 0 || orderTotalByn <= 0) return 0;
    return maxSpendableBonusPoints(bonusBalance, orderTotalByn, deliveryCountry);
  }, [bonusBalance, deliveryCountry, orderTotalByn]);

  useEffect(() => {
    setBonusSpendPointsState((p) => Math.min(p, maxBonusSpendPointsValue));
  }, [maxBonusSpendPointsValue]);

  useEffect(() => {
    if (cartItems.length === 0) setBonusSpendPointsState(0);
  }, [cartItems.length]);

  const checkoutTotalByn = useMemo(
    () => Math.max(0, Math.round((orderTotalByn - bonusDiscountBynValue) * 100) / 100),
    [orderTotalByn, bonusDiscountBynValue],
  );

  const checkoutTotalRub = useMemo(() => {
    if (!deliveryCountry) return orderTotalRub;
    if (deliveryCountry === "BY") {
      return Math.max(0, Math.round(orderTotalRub - rubFromByn(bonusDiscountBynValue)));
    }
    return Math.max(0, orderTotalRub - bonusSpendPoints);
  }, [bonusDiscountBynValue, bonusSpendPoints, deliveryCountry, orderTotalRub]);

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
      repeatOrderToCart,
      bonusBalance,
      bonusSpendPoints,
      setBonusSpendPoints,
      maxBonusSpendPoints: maxBonusSpendPointsValue,
      bonusDiscountByn: bonusDiscountBynValue,
      checkoutTotalByn,
      checkoutTotalRub,
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
      repeatOrderToCart,
      bonusBalance,
      bonusSpendPoints,
      setBonusSpendPoints,
      maxBonusSpendPointsValue,
      bonusDiscountBynValue,
      checkoutTotalByn,
      checkoutTotalRub,
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
