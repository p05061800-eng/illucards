import type { Metadata } from "next";
import CartView from "./CartView";

export const metadata: Metadata = {
  title: "Корзина — IlluCards",
  description: "Выбранные карточки",
};

export default function CartPage() {
  return (
    <main className="main relative overflow-x-hidden text-white">
      <div
        className="pointer-events-none absolute inset-0 -z-0"
        aria-hidden
        style={{
          background: `
            linear-gradient(
              180deg,
              #000000 0%,
              #020105 18%,
              #14081f 50%,
              #020105 82%,
              #000000 100%
            )
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-0"
        aria-hidden
        style={{
          background: `
            radial-gradient(
              ellipse 80% 50% at 50% 30%,
              rgba(88, 28, 135, 0.12) 0%,
              transparent 55%
            )
          `,
        }}
      />
      <CartView />
    </main>
  );
}
