import type { Metadata } from "next";
import SnakeGame from "./SnakeGame";

export const metadata: Metadata = {
  title: "Snake — IlluCards",
  description: "Classic Snake mini-game.",
};

export default function SnakePage() {
  return (
    <main className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-black px-4 pb-16 pt-8 text-white sm:px-6">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 75% 55% at 20% 15%, rgba(88, 28, 135, 0.18) 0%, transparent 55%),
            radial-gradient(ellipse 65% 45% at 85% 25%, rgba(34, 197, 94, 0.08) 0%, transparent 55%),
            linear-gradient(180deg, #000000 0%, #050308 100%)
          `,
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[1200px]">
        <SnakeGame />
      </div>
    </main>
  );
}
