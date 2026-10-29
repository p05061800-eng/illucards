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
  cardHasRarityTag,
  cardUsesAdultFixedPricing,
  parseCardRarity,
} from "../lib/cardRarityTags";
import { deliveryCharge } from "../lib/delivery";
import { normalizeDeliveryCountry, type DeliveryCountry } from "../lib/delivery";
import {
  ADULT_FIXED_PRICE_BYN,
  ADULT_FIXED_PRICE_RUB,
  displayCurrencyForDelivery,
  rubFromByn,
} from "../lib/formatPrice";
import { apiUrl } from "../lib/apiUrl";
import {
  collectionPackLineId,
} from "../lib/collectionBundle";
import {
  cartLineCopyQuantity,
  cartLineGoodsTotal,
  cartLineKey,
  cartLinePieceCount,
  copySlotsForOriginals,
  isCustomOrderCategory,
  isCustomOrderLine,
  newCartLineKey,
} from "../lib/customOrderPricing";
import { readTelegramPrimaryUserId } from "../lib/telegramUserIdentity";
import { useAuth } from "./AuthContext";
import { useCurrency } from "./CurrencyContext";

export type CartLine = {
  id: string;
  /** Уникальная строка корзины (несколько одинаковых карточек на заказ). */
  lineKey?: string;
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
  /** Полноценные экземпляры (полная цена). */
  quantity: number;
  /** Дополнительные копии того же макета (скидка 50%). */
  copyQuantity?: number;
};

/** Ключ записи корзины в `localStorage` */
export const CART_STORAGE_KEY = "illucards-cart";
const STORAGE_KEY = CART_STORAGE_KEY;
const DELIVERY_STORAGE_KEY = "illucards-delivery-country";
/** Последний `updatedAt` с сервера (`/api/user-state`) — для согласования после очистки корзины при подтверждении заказа в боте. */
const USER_STATE_SYNC_AT_KEY = "illucards-user-state-updated-at";
const CART_CLEARED_AT_KEY = "illucards-cart-cleared-at";
/** Когда пользователь последний раз менял локальную корзину (добавление/удаление). */
const CART_LOCAL_MODIFIED_AT_KEY = "illucards-cart-local-modified-at";

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

function readClientSeenCartClearedAt(): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = Number(localStorage.getItem(CART_CLEARED_AT_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

function writeClientSeenCartClearedAt(ts: number): void {
  if (typeof window === "undefined" || !Number.isFinite(ts) || ts <= 0) return;
  try {
    localStorage.setItem(CART_CLEARED_AT_KEY, String(Math.floor(ts)));
  } catch {
    /* ignore */
  }
}

function readLocalCartModifiedAt(): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = Number(localStorage.getItem(CART_LOCAL_MODIFIED_AT_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

function writeLocalCartModifiedAt(ts: number): void {
  if (typeof window === "undefined" || !Number.isFinite(ts) || ts <= 0) return;
  try {
    localStorage.setItem(CART_LOCAL_MODIFIED_AT_KEY, String(Math.floor(ts)));
  } catch {
    /* ignore */
  }
}

function touchLocalCartModifiedAt(): void {
  writeLocalCartModifiedAt(Date.now());
}

function applyLocalCartClear(clearedAt: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, "[]");
  } catch {
    /* ignore */
  }
  writeLocalCartModifiedAt(clearedAt);
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
  return cardHasRarityTag(card, "adult") ? "adult" : card.rarity;
}

function lineFromCard(card: StoredCard): Pick<CartLine, "priceByn" | "priceRub"> {
  if (cardUsesAdultFixedPricing(card)) {
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
    const cqRaw =
      typeof o.copyQuantity === "number"
        ? o.copyQuantity
        : Number(o.copyQuantity);
    const copyQuantity =
      Number.isFinite(cqRaw) && cqRaw > 0 ? Math.min(99, Math.floor(cqRaw)) : 0;
    const storedKey =
      typeof o.lineKey === "string" && o.lineKey.trim()
        ? o.lineKey.trim()
        : "";
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

    const base: CartLine = {
      id,
      title,
      priceByn,
      priceRub,
      frontImage,
      ...(category ? { category } : {}),
      ...(categoryOrder != null ? { categoryOrder } : {}),
      ...(rarity ? { rarity } : {}),
      quantity,
      ...(copyQuantity > 0 ? { copyQuantity } : {}),
      ...(storedKey ? { lineKey: storedKey } : {}),
    };
    if (isCustomOrderLine(base) && quantity > 1) {
      const slots = copySlotsForOriginals(quantity, copyQuantity);
      slots.forEach((copiesOnLine, idx) => {
        out.push({
          ...base,
          quantity: 1,
          lineKey: idx === 0 && storedKey ? storedKey : newCartLineKey(),
          ...(copiesOnLine > 0
            ? { copyQuantity: copiesOnLine }
            : { copyQuantity: undefined }),
        });
      });
      continue;
    }
    if (isCustomOrderLine(base)) {
      out.push({
        ...base,
        quantity: 1,
        lineKey: storedKey || newCartLineKey(),
      });
      continue;
    }
    out.push({
      ...base,
      lineKey: storedKey || id,
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
  addCollectionToCart: (input: {
    collectionName: string;
    cards: StoredCard[];
    priceByn: number;
    priceRub: number;
  }) => void;
  addCustomOrderToCart: (
    card: StoredCard,
    originals: number,
    copies: number,
  ) => void;
  removeFromCart: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  setCopyQuantity: (id: string, copyQuantity: number) => void;
  clearCart: () => void;
  /** Пометить корзину как изменённую локально (например, перед checkout). */
  markCartActive: () => void;
  /**
   * Повтор заказа: добавить позиции в корзину (совпадающие id — суммируем quantity),
   * опционально выставить страну доставки. Обложка из заказа, иначе заглушка.
   */
  repeatOrderToCart: (
    lines: Array<{
      id: string;
      title: string;
      quantity: number;
      copyQuantity?: number;
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
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [deliveryCountry, setDeliveryCountryState] =
    useState<DeliveryCountry | null>(null);
  const { hydrated: authHydrated, primaryTelegramUserId } = useAuth();
  const { currency, setCurrency, hydrated: currencyHydrated } = useCurrency();

  const closeCart = useCallback(() => setCartOpen(false), []);
  const toggleCart = useCallback(() => setCartOpen((o) => !o), []);

  useEffect(() => {
    const loaded = loadFromStorage();
    setCartItems(loaded);
    setDeliveryCountryState(loadDeliveryCountry());
    if (loaded.length > 0) {
      touchLocalCartModifiedAt();
    }
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
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
    } catch {
      /* ignore quota */
    }
  }, [cartItems, hydrated]);

  const refreshServerUserStateMeta = useCallback(async () => {
    if (!authHydrated) return;
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
        cartClearedAt?: unknown;
      };
      const ts =
        typeof data.updatedAt === "number" && Number.isFinite(data.updatedAt)
          ? data.updatedAt
          : 0;
      const serverCart = normalizeLines(data.cart);
      const cartClearedAt =
        typeof data.cartClearedAt === "number" && Number.isFinite(data.cartClearedAt)
          ? data.cartClearedAt
          : 0;
      const prevSeenClear = readClientSeenCartClearedAt();
      const localModified = readLocalCartModifiedAt();

      if (ts > 0) {
        writeClientSeenServerUpdatedAt(ts);
      }

      // Корзину с сайта чистим только после оплаты (новый cartClearedAt).
      // Не затираем локальные позиции, если клиент менял корзину позже очистки.
      if (cartClearedAt > prevSeenClear) {
        writeClientSeenCartClearedAt(cartClearedAt);
        if (
          serverCart.length === 0 &&
          localModified > 0 &&
          localModified < cartClearedAt
        ) {
          setCartItems((prev) => (prev.length === 0 ? prev : []));
          applyLocalCartClear(cartClearedAt);
        }
      } else if (serverCart.length > 0) {
        setCartItems((prev) => (prev.length === 0 ? serverCart : prev));
      }
    } catch {
      /* ignore */
    }
  }, [authHydrated]);

  const openCart = useCallback(() => {
    setCartOpen(true);
    void refreshServerUserStateMeta();
  }, [refreshServerUserStateMeta]);

  useEffect(() => {
    if (!hydrated || !authHydrated) return;
    void refreshServerUserStateMeta();
    const tick = window.setInterval(() => {
      void refreshServerUserStateMeta();
    }, 12000);
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshServerUserStateMeta();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [authHydrated, hydrated, refreshServerUserStateMeta]);

  useEffect(() => {
    if (!hydrated) return;
    const userId = primaryTelegramUserId ?? readTelegramPrimaryUserId();
    if (userId == null) return;
    const seen = readClientSeenServerUpdatedAt();
    const seenClear = readClientSeenCartClearedAt();
    const cartPayload = cartItems.map((x) => ({
      id: x.id,
      ...(x.lineKey ? { lineKey: x.lineKey } : {}),
      title: x.title,
      quantity: x.quantity,
      ...(x.copyQuantity && x.copyQuantity > 0
        ? { copyQuantity: x.copyQuantity }
        : {}),
      priceByn: x.priceByn,
      priceRub: x.priceRub,
      frontImage: x.frontImage,
      ...(x.category ? { category: x.category } : {}),
      ...(x.categoryOrder != null ? { categoryOrder: x.categoryOrder } : {}),
      ...(x.rarity ? { rarity: x.rarity } : {}),
    }));
    const shouldSyncEmptyCart = cartPayload.length === 0 && seenClear > 0;
    if (cartPayload.length === 0 && deliveryCountry == null && !shouldSyncEmptyCart) {
      return;
    }
    void fetch(apiUrl("/api/user-state"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        ...(seen > 0 ? { client_seen_updated_at: seen } : {}),
        ...(seenClear > 0 ? { client_seen_cart_cleared_at: seenClear } : {}),
        ...(deliveryCountry != null ? { delivery_country: deliveryCountry } : {}),
        ...(deliveryCountry != null
          ? { currency: displayCurrencyForDelivery(deliveryCountry) }
          : {}),
        ...(cartPayload.length > 0
          ? { cart: cartPayload }
          : shouldSyncEmptyCart
            ? { cart: [], clear_cart: true }
            : {}),
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
  }, [cartItems, deliveryCountry, hydrated, primaryTelegramUserId]);

  const addToCart = useCallback((card: StoredCard) => {
    if (isCustomOrderCategory(card.category)) {
      touchLocalCartModifiedAt();
      const { priceByn, priceRub } = lineFromCard(card);
      setCartItems((prev) => [
        ...prev,
        {
          id: card.id,
          lineKey: newCartLineKey(),
          title: card.title,
          priceByn,
          priceRub,
          frontImage: card.frontImage,
          category: card.category,
          categoryOrder: card.categoryOrder,
          rarity: cartLineRarityForStorage(card),
          quantity: 1,
        },
      ]);
      return;
    }
    touchLocalCartModifiedAt();
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
          lineKey: card.id,
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

  const addCollectionToCart = useCallback(
    (input: {
      collectionName: string;
      cards: StoredCard[];
      priceByn: number;
      priceRub: number;
    }) => {
      const packCards = input.cards.filter(
        (c) => String(c?.id || "").trim() && !isCustomOrderCategory(c.category),
      );
      if (packCards.length === 0) return;
      const packId = collectionPackLineId(input.collectionName);
      const cardIds = new Set(packCards.map((c) => c.id));
      const cover = packCards[0];
      const priceByn = Number.isFinite(input.priceByn)
        ? Math.round(input.priceByn * 100) / 100
        : 0;
      const priceRub = Number.isFinite(input.priceRub)
        ? Math.round(input.priceRub)
        : 0;
      if (priceByn <= 0 && priceRub <= 0) return;
      touchLocalCartModifiedAt();
      setCartItems((prev) => {
        const kept = prev.filter(
          (l) => l.id !== packId && !cardIds.has(l.id),
        );
        const adult = packCards.some((c) => cardHasRarityTag(c, "adult"));
        return [
          ...kept,
          {
            id: packId,
            lineKey: packId,
            title: `Вся коллекция ${input.collectionName.trim()}`.slice(0, 300),
            priceByn,
            priceRub,
            frontImage: cover.frontImage,
            category: cover.category,
            rarity: adult ? "adult" : cover.rarity,
            quantity: 1,
          },
        ];
      });
    },
    [],
  );

  const addCustomOrderToCart = useCallback(
    (card: StoredCard, originals: number, copies: number) => {
      touchLocalCartModifiedAt();
      const orig = Math.max(1, Math.min(99, Math.floor(originals) || 1));
      const copyN = Math.max(0, Math.min(99, Math.floor(copies) || 0));
      const { priceByn, priceRub } = lineFromCard(card);
      const slots = copySlotsForOriginals(orig, copyN);
      setCartItems((prev) => [
        ...prev,
        ...slots.map((copiesOnLine) => ({
          id: card.id,
          lineKey: newCartLineKey(),
          title: card.title,
          priceByn,
          priceRub,
          frontImage: card.frontImage,
          category: card.category,
          categoryOrder: card.categoryOrder,
          rarity: cartLineRarityForStorage(card),
          quantity: 1,
          ...(copiesOnLine > 0 ? { copyQuantity: copiesOnLine } : {}),
        })),
      ]);
    },
    [],
  );

  const removeFromCart = useCallback((lineKey: string) => {
    touchLocalCartModifiedAt();
    setCartItems((prev) =>
      prev.filter((l) => cartLineKey(l) !== lineKey),
    );
  }, []);

  const setQuantity = useCallback((lineKey: string, quantity: number) => {
    touchLocalCartModifiedAt();
    const q = Math.floor(quantity);
    setCartItems((prev) => {
      const i = prev.findIndex((l) => cartLineKey(l) === lineKey);
      if (i < 0) return prev;
      const line = prev[i];
      if (isCustomOrderLine(line)) {
        if (q < 1) return prev.filter((_, idx) => idx !== i);
        if (q <= 1) return prev.map((l, idx) => (idx === i ? { ...l, quantity: 1 } : l));
        const extra = Math.min(99, q) - 1;
        const added: CartLine[] = Array.from({ length: extra }, () => {
          const { copyQuantity: _copies, ...rest } = line;
          return {
            ...rest,
            quantity: 1,
            lineKey: newCartLineKey(),
          };
        });
        return [...prev.slice(0, i + 1), ...added, ...prev.slice(i + 1)].map(
          (l, idx) => (idx === i ? { ...l, quantity: 1 } : l),
        );
      }
      if (q < 1) return prev.filter((_, idx) => idx !== i);
      return prev.map((l, idx) =>
        idx === i ? { ...l, quantity: Math.min(99, q) } : l,
      );
    });
  }, []);

  const setCopyQuantity = useCallback((lineKey: string, copyQuantity: number) => {
    touchLocalCartModifiedAt();
    const n = Math.floor(copyQuantity);
    const capped = Number.isFinite(n) ? Math.max(0, Math.min(99, n)) : 0;
    setCartItems((prev) =>
      prev.map((l) => {
        if (cartLineKey(l) !== lineKey) return l;
        if (capped <= 0) {
          const { copyQuantity: _drop, ...rest } = l;
          return rest;
        }
        return { ...l, copyQuantity: capped };
      }),
    );
  }, []);

  const clearCart = useCallback(() => {
    touchLocalCartModifiedAt();
    setCartItems([]);
    applyLocalCartClear(Date.now());
  }, []);

  const markCartActive = useCallback(() => {
    touchLocalCartModifiedAt();
  }, []);

  const PLACEHOLDER_IMAGE = "/file.svg";

  const repeatOrderToCart = useCallback(
    (
      lines: Array<{
        id: string;
        title: string;
        quantity: number;
        copyQuantity?: number;
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
        const copiesOnOrder = cartLineCopyQuantity(l);
        if (isCustomOrderCategory(category) || copiesOnOrder > 0) {
          const slots = copySlotsForOriginals(q, copiesOnOrder);
          for (const copiesOnLine of slots) {
            toAdd.push({
              id,
              lineKey: newCartLineKey(),
              title,
              priceByn,
              priceRub,
              frontImage: img,
              quantity: 1,
              ...(copiesOnLine > 0 ? { copyQuantity: copiesOnLine } : {}),
              ...(category ? { category } : {}),
              ...(rarity ? { rarity } : {}),
            });
          }
          continue;
        }
        toAdd.push({
          id,
          lineKey: id,
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

      touchLocalCartModifiedAt();
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
    () => cartItems.reduce((s, l) => s + cartLinePieceCount(l), 0),
    [cartItems]
  );

  const totalPriceByn = useMemo(
    () =>
      cartItems.reduce((s, l) => s + cartLineGoodsTotal(l).byn, 0),
    [cartItems]
  );

  const totalPriceRub = useMemo(
    () =>
      cartItems.reduce((s, l) => s + cartLineGoodsTotal(l).rub, 0),
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
      addCollectionToCart,
      addCustomOrderToCart,
      removeFromCart,
      setQuantity,
      setCopyQuantity,
      clearCart,
      markCartActive,
      repeatOrderToCart,
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
      addCollectionToCart,
      addCustomOrderToCart,
      removeFromCart,
      setQuantity,
      setCopyQuantity,
      clearCart,
      markCartActive,
      repeatOrderToCart,
    ]
  );

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  );
}

/** Снимок корзины из localStorage (для оформления заказа сразу после входа в Telegram). */
export function readClientCheckoutSnapshot(): {
  cartItems: CartLine[];
  deliveryCountry: DeliveryCountry;
  orderTotalByn: number;
} | null {
  if (typeof window === "undefined") return null;
  const cartItems = loadFromStorage();
  const deliveryCountry = loadDeliveryCountry();
  if (!cartItems.length || !deliveryCountry) return null;
  const goodsTotal = cartItems.reduce((s, l) => s + cartLineGoodsTotal(l).byn, 0);
  const deliveryByn = deliveryCharge(deliveryCountry).amountByn;
  const orderTotalByn =
    Math.round((goodsTotal + deliveryByn) * 100) / 100;
  return { cartItems, deliveryCountry, orderTotalByn };
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}
