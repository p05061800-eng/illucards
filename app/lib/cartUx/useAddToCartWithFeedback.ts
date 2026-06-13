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
  const { addToCart } = useCart();

  return useCallback(
    (card: StoredCard, flySource?: HTMLElement | null) => {
      playClick();
      flyToCart(flySource ?? null);
      addToCart(card);
    },
    [addToCart]
  );
}
