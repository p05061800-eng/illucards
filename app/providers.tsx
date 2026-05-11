"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { CartDrawer } from "./components/CartDrawer";
import { CurrencyPrompt } from "./components/CurrencyPrompt";
import { TelegramLoginWaitPoller } from "./components/TelegramLoginWaitPoller";
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
      <TelegramLoginWaitPoller />
      <CurrencyProvider>
        <FavoritesProvider>
          <CategoryFramesProvider>
            <CardRatingsProvider>
              <CartProvider>
                <CatalogFilterProvider>
                  <AdultContentProvider>
                    {children}
                    <CartDrawer />
                    <CurrencyPrompt />
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
