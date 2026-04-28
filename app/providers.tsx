"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { CartDrawer } from "./components/CartDrawer";
import { TelegramUserQueryAuth } from "./components/TelegramUserQueryAuth";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { CardRatingsProvider } from "./context/CardRatingsContext";
import { CatalogFilterProvider } from "./context/CatalogFilterContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import { FavoritesProvider } from "./context/FavoritesContext";
import { AdultContentProvider } from "./context/AdultContentContext";
import { CategoryFramesProvider } from "./context/CategoryFramesContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Suspense fallback={null}>
        <TelegramUserQueryAuth />
      </Suspense>
      <CurrencyProvider>
        <FavoritesProvider>
          <CategoryFramesProvider>
            <CardRatingsProvider>
              <CartProvider>
                <CatalogFilterProvider>
                  <AdultContentProvider>
                    {children}
                    <CartDrawer />
                  </AdultContentProvider>
                </CatalogFilterProvider>
              </CartProvider>
            </CardRatingsProvider>
          </CategoryFramesProvider>
        </FavoritesProvider>
      </CurrencyProvider>
    </AuthProvider>
  );
}
