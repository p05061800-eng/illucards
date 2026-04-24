"use client";

import { ShoppingBag } from "lucide-react";
import { useCart } from "@/app/context/CartContext";

/**
 * Плавающая корзина справа при прокрутке: всегда видно число позиций и быстрый доступ к черновику заказа.
 */
export function FloatingCartFab() {
  const { itemCount, hydrated, cartOpen, openCart } = useCart();
  const count = hydrated ? itemCount : 0;

  return (
    <button
      type="button"
      data-cart-fly-target
      onClick={openCart}
      aria-expanded={cartOpen}
      aria-controls="cart-drawer-panel"
      aria-label={
        count === 0
          ? "Корзина пуста"
          : `Корзина: ${count} ${count === 1 ? "товар" : count < 5 ? "товара" : "товаров"}`
      }
      title="Корзина"
      className="pointer-events-auto fixed bottom-24 right-[max(1rem,env(safe-area-inset-right,0px))] z-[185] flex h-14 w-14 touch-manipulation items-center justify-center rounded-full border-2 border-white/45 bg-green-500 text-white shadow-[0_4px_0_rgba(0,0,0,0.28),0_10px_32px_rgba(0,0,0,0.45)] transition hover:border-white/70 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 sm:bottom-28 sm:right-[max(1.25rem,env(safe-area-inset-right,0px))] sm:h-16 sm:w-16"
    >
      <ShoppingBag className="h-6 w-6 text-white sm:h-7 sm:w-7" aria-hidden />
      <span
        className={`absolute -right-0.5 -top-0.5 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums leading-none ring-2 ring-black sm:h-7 sm:min-w-[1.75rem] sm:text-xs ${
          count > 0
            ? "bg-green-500 text-white"
            : "bg-zinc-800 text-zinc-300 ring-zinc-950"
        }`}
        aria-hidden
      >
        {count > 99 ? "99+" : count}
      </span>
    </button>
  );
}
