"use client";

import Image from "next/image";
import Link from "next/link";
import { useId } from "react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import { useCategoryTiles } from "../context/CategoryFramesContext";
import { getCardArtIntrinsicSize } from "../lib/cardArtIntrinsicSize";
import { displayCurrencyForDelivery, formatCardPrice } from "../lib/formatPrice";
import { TelegramCheckoutButton } from "@/components/checkout/TelegramCheckoutButton";
import { DeliveryCountryField } from "../components/DeliveryCountryField";
import { CartOrderTotals } from "../components/cart/CartOrderTotals";

export default function CartView() {
  const {
    cartItems,
    totalPriceByn,
    totalPriceRub,
    deliveryCountry,
    setDeliveryCountry,
    deliveryPriceByn,
    deliveryPriceRub,
    orderTotalByn,
    orderTotalRub,
    checkoutTotalByn,
    checkoutTotalRub,
    removeFromCart,
    setQuantity,
    hydrated,
  } = useCart();
  const { primaryTelegramUserId } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const priceCurrency = displayCurrencyForDelivery(deliveryCountry);
  const categoryTiles = useCategoryTiles();
  const deliveryFieldId = useId();
  return (
    <>
      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8">
        <h1 className="mb-5 bg-gradient-to-r from-white via-purple-100 to-violet-200 bg-clip-text text-center text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
          Корзина
        </h1>

        {!hydrated ? (
          <p className="text-center text-sm text-zinc-500">Загрузка…</p>
        ) : cartItems.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
            <p className="text-zinc-400">Корзина пуста</p>
            <Link
              href="/#collection"
              className="mt-5 inline-flex rounded-full border border-purple-500/40 bg-purple-950/40 px-6 py-2.5 text-sm font-medium text-purple-200 transition hover:border-purple-400/60 hover:bg-purple-900/50"
            >
              В каталог
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1fr_min(280px,34%)] lg:items-start lg:gap-5">
            <ul className="space-y-2">
              {cartItems.map((line) => (
                <li
                  key={line.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 sm:p-3"
                >
                  <div className="flex w-[4.25rem] shrink-0 items-start justify-center self-start overflow-visible rounded-lg bg-zinc-900 ring-1 ring-white/10 sm:w-[5rem]">
                    {line.frontImage ? (
                      <Image
                        src={line.frontImage}
                        alt={line.title}
                        width={
                          getCardArtIntrinsicSize(line.category, categoryTiles).width
                        }
                        height={
                          getCardArtIntrinsicSize(line.category, categoryTiles).height
                        }
                        className="h-auto w-full rounded-lg"
                        sizes="80px"
                        style={{
                          width: "100%",
                          height: "auto",
                          objectFit: "unset",
                        }}
                      />
                    ) : (
                      <div className="flex min-h-[3rem] items-center justify-center text-xs text-zinc-600">
                        —
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Link
                      href={`/card/${line.id}`}
                      className="line-clamp-2 text-sm font-semibold leading-snug text-white transition hover:text-purple-200 sm:text-base"
                    >
                      {line.title}
                    </Link>
                    <p className="text-sm font-medium tabular-nums text-purple-200/90">
                      {formatCardPrice(
                        line.priceByn * line.quantity,
                        priceCurrency,
                        priceCurrency === "RUB"
                          ? line.priceRub * line.quantity
                          : undefined,
                      )}
                      <span className="font-normal text-zinc-500">
                        {" "}
                        · {line.quantity} шт.
                      </span>
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center rounded-md border border-white/15 bg-black/30 text-sm">
                        <button
                          type="button"
                          onClick={() => setQuantity(line.id, line.quantity - 1)}
                          className="px-2.5 py-1 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                          aria-label="Уменьшить"
                        >
                          −
                        </button>
                        <span className="min-w-[1.75rem] px-1.5 text-center tabular-nums text-zinc-200">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(line.id, line.quantity + 1)}
                          className="px-2.5 py-1 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                          aria-label="Увеличить"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(line.id)}
                        className="text-xs text-zinc-500 transition hover:text-red-400"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4 lg:sticky lg:top-24">
              <DeliveryCountryField
                id={deliveryFieldId}
                value={deliveryCountry}
                onChange={setDeliveryCountry}
                compact
              />
              {deliveryCountry != null ? (
                <p className="text-[10px] text-zinc-500">
                  Цены в {priceCurrency === "RUB" ? "RUB" : "BYN"} по доставке
                </p>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Валюта
                  </span>
                  <div
                    className="inline-flex rounded-full border border-white/12 bg-black/50 p-0.5"
                    role="group"
                    aria-label="Валюта"
                  >
                    <button
                      type="button"
                      onClick={() => setCurrency("BYN")}
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                        currency === "BYN"
                          ? "bg-purple-600/90 text-white"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      BY
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrency("RUB")}
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                        currency === "RUB"
                          ? "bg-purple-600/90 text-white"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      RUB
                    </button>
                  </div>
                </div>
              )}
              <CartOrderTotals
                deliveryCountry={deliveryCountry}
                totalPriceByn={totalPriceByn}
                totalPriceRub={totalPriceRub}
                deliveryPriceByn={deliveryPriceByn}
                deliveryPriceRub={deliveryPriceRub}
                orderTotalByn={orderTotalByn}
                orderTotalRub={orderTotalRub}
                checkoutTotalByn={checkoutTotalByn}
                checkoutTotalRub={checkoutTotalRub}
              />
              <TelegramCheckoutButton className="rounded-full py-3.5 text-sm sm:text-[15px]" />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
