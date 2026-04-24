import type { Metadata } from "next";
import { Suspense } from "react";
import CheckoutPageClient from "./CheckoutPageClient";

export const metadata: Metadata = {
  title: "Оплата — IlluCards",
  description: "Безопасная оплата заказа",
};

export default function CheckoutPage() {
  return (
    <main className="main relative overflow-x-hidden text-white">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 90% 50% at 50% -10%, rgba(88, 28, 135, 0.25), transparent 50%),
            linear-gradient(180deg, #050208 0%, #0c0614 40%, #050208 100%)
          `,
        }}
      />
      <Suspense
        fallback={
          <p className="py-24 text-center text-sm text-zinc-500">Загрузка…</p>
        }
      >
        <CheckoutPageClient />
      </Suspense>
    </main>
  );
}
