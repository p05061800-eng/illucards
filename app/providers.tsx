"use client";

import type { ReactNode } from "react";
import { CartDrawer } from "./components/CartDrawer";
import { CartProvider } from "./context/CartContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import { FavoritesProvider } from "./context/FavoritesContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CurrencyProvider>
      <FavoritesProvider>
        <CartProvider>
          {children}
          <CartDrawer />
        </CartProvider>
      </FavoritesProvider>
    </CurrencyProvider>
  );
}
