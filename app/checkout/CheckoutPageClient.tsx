"use client";

import Link from "next/link";
import { useId } from "react";
import { TelegramCheckoutButton } from "@/components/checkout/TelegramCheckoutButton";
import { DeliveryCountryField } from "@/app/components/DeliveryCountryField";
import { useCart } from "@/app/context/CartContext";

export default function CheckoutPageClient() {
  const { hydrated, deliveryCountry, setDeliveryCountry } = useCart();
  const deliveryFieldId = useId();

  if (!hydrated) {
    return (
      <p className="text-center text-sm text-zinc-500">Загрузка…</p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-20 pt-12 sm:px-6">
      <h1 className="mb-3 text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Заказ
      </h1>
      <p className="mb-8 text-center text-sm leading-relaxed text-zinc-400">
        Войдите через Telegram, если ещё не вошли. После нажатия «Оформить заказ»
        откроется бот с текстом заказа — без копирования и лишних окон.
      </p>
      <DeliveryCountryField
        id={deliveryFieldId}
        value={deliveryCountry}
        onChange={setDeliveryCountry}
        className="mb-6"
      />
      <TelegramCheckoutButton />
      <Link
        href="/cart"
        className="mt-6 flex w-full items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] py-3 text-sm font-medium text-zinc-400 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-zinc-200"
      >
        В корзину
      </Link>
    </div>
  );
}
