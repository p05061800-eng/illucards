"use client";

import { useCallback } from "react";
import type { StoredCard } from "../../api/cards/route";
import { useCart } from "../../context/CartContext";
import { flyToCart } from "./flyToCart";
import { playClick } from "./playClick";

/**
 * Добавление в корзину: звук + полёт превью + обновление `cartItems` в контексте.
 */
export function useAddToCartWithFeedback() {
  const { addToCart, addCustomOrderToCart } = useCart();

  return useCallback(
    (
      card: StoredCard,
      flySource?: HTMLElement | null,
      qty?: { originals?: number; copies?: number },
    ) => {
      playClick();
      flyToCart(flySource ?? null);
      if (qty) {
        addCustomOrderToCart(card, qty.originals ?? 1, qty.copies ?? 0);
        return;
      }
      addToCart(card);
    },
    [addToCart, addCustomOrderToCart]
  );
}
