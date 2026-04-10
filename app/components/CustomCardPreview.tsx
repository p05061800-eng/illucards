"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";

const PREVIEW_FRAME =
  "ring-1 ring-purple-400/55 shadow-[0_0_26px_rgba(168,85,247,0.5)] group-hover/preview:shadow-[0_0_52px_rgba(192,132,252,0.68),0_0_88px_rgba(168,85,247,0.38)] group-hover/preview:ring-purple-300/65";

function computeEffectTransform(
  effect: string,
  nx: number,
  ny: number
): { rotateX: number; rotateY: number } {
  const maxTilt = 12;
  switch (effect) {
    case "3d-horizontal":
      return { rotateX: 0, rotateY: nx * maxTilt };
    case "vario":
      return { rotateX: -ny * 5, rotateY: nx * 5 };
    default:
      return { rotateX: 0, rotateY: nx * maxTilt };
  }
}

function VarioShineOverlay({ nx, ny }: { nx: number; ny: number }) {
  const x = (nx + 1) / 2;
  const y = (ny + 1) / 2;
  const pos = `${x * 100}% ${y * 100}%`;
  const transition = "background-position 0.1s linear";

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-2xl"
      aria-hidden
    >
      <div
        className="absolute inset-0 mix-blend-overlay"
        style={{
          backgroundImage:
            "linear-gradient(120deg, transparent, rgba(255,255,255,0.4), transparent)",
          backgroundSize: "240% 240%",
          backgroundPosition: pos,
          backgroundRepeat: "no-repeat",
          transition,
          opacity: 0.85,
        }}
      />
      <div
        className="absolute inset-0 mix-blend-screen"
        style={{
          backgroundImage:
            "linear-gradient(118deg, rgba(147,51,234,0.22) 0%, rgba(59,130,246,0.18) 35%, rgba(236,72,153,0.2) 65%, rgba(168,85,247,0.15) 100%)",
          backgroundSize: "220% 220%",
          backgroundPosition: pos,
          backgroundRepeat: "no-repeat",
          transition,
          opacity: 0.28,
        }}
      />
    </div>
  );
}

function PlaceholderFace() {
  return (
    <div
      className="absolute inset-0 rounded-2xl bg-gradient-to-br from-zinc-800 to-purple-950/50 ring-1 ring-purple-500/20"
      aria-hidden
    />
  );
}

type Props = {
  imageUrl: string | null;
  effect: "3d-horizontal" | "vario";
  title: string;
  categoryBackgroundUrl: string | null;
};

export function CustomCardPreview({
  imageUrl,
  effect,
  title,
  categoryBackgroundUrl,
}: Props) {
  const isVario = effect === "vario";
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [shineNx, setShineNx] = useState(0);
  const [shineNy, setShineNy] = useState(0);

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const nx = x * 2 - 1;
      const ny = y * 2 - 1;
      const t = computeEffectTransform(effect, nx, ny);
      setRotateX(t.rotateX);
      setRotateY(t.rotateY);
      if (isVario) {
        setShineNx(nx);
        setShineNy(ny);
      }
    },
    [effect, isVario]
  );

  const handleMouseLeave = useCallback(() => {
    setRotateX(0);
    setRotateY(0);
    setShineNx(0);
    setShineNy(0);
  }, []);

  const tiltStyle: CSSProperties = {
    transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
    transformStyle: "preserve-3d",
    transition: "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
  };

  const alt = title.trim() || "Предпросмотр";

  return (
    <div className="group/preview mx-auto w-full max-w-[min(100%,380px)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:[filter:drop-shadow(0_20px_40px_rgba(0,0,0,0.5))] hover:brightness-105">
      <div className="relative w-full">
        {categoryBackgroundUrl ? (
          <div
            className="pointer-events-none absolute inset-[-14px] z-0 rounded-3xl transition-opacity duration-500 group-hover/preview:opacity-40"
            style={{
              backgroundImage: `url(${categoryBackgroundUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(20px)",
              opacity: 0.3,
            }}
            aria-hidden
          />
        ) : null}
        <div
          className={`relative z-10 rounded-2xl ring-1 transition-[box-shadow,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[box-shadow,filter] group-hover/preview:brightness-[1.04] ${PREVIEW_FRAME}`}
        >
          <div
            className="relative z-10 w-full cursor-grab active:cursor-grabbing"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <div
              className="relative w-full origin-center will-change-transform"
              style={tiltStyle}
            >
              <span
                className="pointer-events-none absolute right-3 top-3 z-30 flex h-8 min-w-[2rem] items-center justify-center rounded-md border border-purple-400/70 bg-purple-950/90 px-2 text-[10px] font-extrabold uppercase leading-none text-purple-100 shadow-[0_0_14px_rgba(168,85,247,0.55)] backdrop-blur-sm"
                title="Кастомная карточка"
              >
                Своя
              </span>
              <div className="relative aspect-[3/4] w-full">
                {imageUrl ? (
                  <div className="absolute inset-0 overflow-hidden rounded-2xl">
                    <img
                      src={imageUrl}
                      alt={alt}
                      className="h-full w-full rounded-2xl object-cover"
                    />
                  </div>
                ) : (
                  <PlaceholderFace />
                )}
                {isVario && imageUrl ? (
                  <VarioShineOverlay nx={shineNx} ny={shineNy} />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
