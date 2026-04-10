import type { Metadata } from "next";
import CustomCardPageClient from "./CustomCardPageClient";

export const metadata: Metadata = {
  title: "Своя карточка — IlluCards",
  description:
    "Создайте кастомную коллекционную карточку с эффектами 3D и Vario.",
};

export default function CustomCardPage() {
  return (
    <main className="relative min-h-screen overflow-hidden text-white">
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
              ellipse 80% 50% at 50% 25%,
              rgba(88, 28, 135, 0.14) 0%,
              transparent 55%
            )
          `,
        }}
      />
      <CustomCardPageClient />
    </main>
  );
}
