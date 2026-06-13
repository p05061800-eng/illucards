"use client";

import { useRef, type CSSProperties, type MouseEvent } from "react";

type Props = {
  /** URL лицевого изображения (например из `card.frontImage`). */
  image: string;
  className?: string;
  /** Подпись для доступности (роль img). */
  alt?: string;
};

function cssUrl(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export default function LenticularCard({
  image,
  className = "",
  alt,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = rect.width > 0 ? x / rect.width : 0.5;
    el.style.backgroundPosition = `${percent * 100}% 50%, center`;
  }

  function handleLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.backgroundPosition = "50% 50%, center";
  }

  const trimmed = image?.trim() ?? "";
  if (!trimmed) {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl bg-zinc-800 ${className}`.trim()}
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}
        role={alt ? "img" : undefined}
        aria-label={alt}
      />
    );
  }

  const style: CSSProperties = {
    backgroundImage: `linear-gradient(120deg, rgba(255,255,255,0.15) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.15) 75%), url(${cssUrl(trimmed)})`,
    backgroundSize: "200% 100%, cover",
    backgroundPosition: "50% 50%, center",
    backgroundBlendMode: "overlay",
    boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`relative h-full w-full overflow-hidden rounded-2xl [backface-visibility:hidden] ${className}`.trim()}
      style={style}
      role="img"
      aria-label={alt ?? "Лицевая сторона карточки"}
    />
  );
}
