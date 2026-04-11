"use client";

import type { ReactNode } from "react";
import { CartDrawer } from "./components/CartDrawer";
import { CartProvider } from "./context/CartContext";
import { CatalogFilterProvider } from "./context/CatalogFilterContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import { FavoritesProvider } from "./context/FavoritesContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CurrencyProvider>
      <FavoritesProvider>
        <CartProvider>
          <CatalogFilterProvider>
            {children}
            <CartDrawer />
          </CatalogFilterProvider>
        </CartProvider>
      </FavoritesProvider>
    </CurrencyProvider>
  );
}
