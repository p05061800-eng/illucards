"use client";

import Image from "next/image";
import Link from "next/link";
import { useId } from "react";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import { useCategoryTiles } from "../context/CategoryFramesContext";
import { getCardArtIntrinsicSize } from "../lib/cardArtIntrinsicSize";
import { displayCurrencyForDelivery, formatCardPrice } from "../lib/formatPrice";
import { TelegramCheckoutButton } from "@/components/checkout/TelegramCheckoutButton";
import { DeliveryCountryField } from "../components/DeliveryCountryField";

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
    removeFromCart,
    setQuantity,
    hydrated,
  } = useCart();
  const { currency, setCurrency } = useCurrency();
  const priceCurrency = displayCurrencyForDelivery(deliveryCountry);
  const categoryTiles = useCategoryTiles();
  const deliveryFieldId = useId();

  return (
    <>
      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-24 pt-10 sm:px-6">
        <h1 className="mb-10 bg-gradient-to-r from-white via-purple-100 to-violet-200 bg-clip-text text-center text-3xl font-bold tracking-tight text-transparent">
          Корзина
        </h1>

        {!hydrated ? (
          <p className="text-center text-sm text-zinc-500">Загрузка…</p>
        ) : cartItems.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
            <p className="text-zinc-400">Корзина пуста</p>
            <Link
              href="/#collection"
              className="mt-6 inline-flex rounded-full border border-purple-500/40 bg-purple-950/40 px-6 py-2.5 text-sm font-medium text-purple-200 transition hover:border-purple-400/60 hover:bg-purple-900/50"
            >
              В каталог
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-3">
              {cartItems.map((line) => (
                <li
                  key={line.id}
                  className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:p-4"
                >
                  <div className="flex w-[4.5rem] shrink-0 items-start justify-center self-start overflow-visible rounded-2xl bg-zinc-900 ring-1 ring-white/10 sm:w-[5.25rem]">
                    {line.frontImage ? (
                      <Image
                        src={line.frontImage}
                        alt={line.title}
                        width={
                          getCardArtIntrinsicSize(
                            line.category,
                            categoryTiles,
                          ).width
                        }
                        height={
                          getCardArtIntrinsicSize(
                            line.category,
                            categoryTiles,
                          ).height
                        }
                        className="h-auto w-full rounded-2xl"
                        sizes="84px"
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
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                    <div>
                      <Link
                        href={`/card/${line.id}`}
                        className="font-semibold text-white transition hover:text-purple-200"
                      >
                        {line.title}
                      </Link>
                      <p className="mt-1 text-xs leading-snug text-purple-200/90 sm:text-sm">
                        {formatCardPrice(
                          line.priceByn,
                          priceCurrency,
                          priceCurrency === "RUB" ? line.priceRub : undefined
                        )}{" "}
                        × {line.quantity} ={" "}
                        {formatCardPrice(
                          line.priceByn * line.quantity,
                          priceCurrency,
                          priceCurrency === "RUB"
                            ? line.priceRub * line.quantity
                            : undefined
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center rounded-lg border border-white/15 bg-black/30">
                        <button
                          type="button"
                          onClick={() =>
                            setQuantity(line.id, line.quantity - 1)
                          }
                          className="px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
                          aria-label="Уменьшить"
                        >
                          −
                        </button>
                        <span className="min-w-[2rem] px-2 text-center text-sm tabular-nums text-zinc-200">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setQuantity(line.id, line.quantity + 1)
                          }
                          className="px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
                          aria-label="Увеличить"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(line.id)}
                        className="text-xs text-zinc-500 underline-offset-2 transition hover:text-red-400 hover:underline"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-6 border-t border-white/10 pt-8">
              <DeliveryCountryField
                id={deliveryFieldId}
                value={deliveryCountry}
                onChange={setDeliveryCountry}
                className="max-w-md"
              />
              {deliveryCountry != null ? (
                <p className="text-xs leading-relaxed text-zinc-500">
                  Цены в корзине — в{" "}
                  {priceCurrency === "RUB"
                    ? "российских рублях (Россия, Украина, другие страны)"
                    : "белорусских рублях (Беларусь)"}{" "}
                  по выбранной доставке.
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
                          ? "bg-purple-600/90 text-white shadow-[0_0_14px_rgba(168,85,247,0.35)]"
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
                          ? "bg-purple-600/90 text-white shadow-[0_0_14px_rgba(168,85,247,0.35)]"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      RUB
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2 text-sm sm:text-base">
                  <div className="flex items-baseline justify-between gap-6 sm:justify-start sm:gap-10">
                    <span className="text-zinc-500">Товары</span>
                    <span className="tabular-nums text-zinc-200">
                      {formatCardPrice(
                        totalPriceByn,
                        priceCurrency,
                        priceCurrency === "RUB" ? totalPriceRub : undefined
                      )}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-6 sm:justify-start sm:gap-10">
                    <span className="text-zinc-500">Доставка</span>
                    <span className="tabular-nums text-zinc-200">
                      {deliveryCountry
                        ? formatCardPrice(
                            deliveryPriceByn,
                            priceCurrency,
                            priceCurrency === "RUB"
                              ? deliveryPriceRub
                              : undefined
                          )
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-6 border-t border-white/10 pt-2 sm:justify-start sm:gap-10">
                    <span className="font-medium text-zinc-400">Итого</span>
                    <span className="bg-gradient-to-r from-purple-200 to-violet-200 bg-clip-text text-lg font-semibold tabular-nums text-transparent sm:text-xl">
                      {deliveryCountry
                        ? formatCardPrice(
                            orderTotalByn,
                            priceCurrency,
                            priceCurrency === "RUB" ? orderTotalRub : undefined
                          )
                        : "—"}
                    </span>
                  </div>
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[280px]">
                  <TelegramCheckoutButton className="rounded-full py-4 text-[15px]" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
