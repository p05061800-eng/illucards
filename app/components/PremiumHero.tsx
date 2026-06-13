"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useCurrency } from "../context/CurrencyContext";
import { useCategoryTiles } from "../context/CategoryFramesContext";
import { getCardArtIntrinsicSize } from "../lib/cardArtIntrinsicSize";
import { NEXT_IMAGE_CARD_ART_SIZES } from "../lib/imageFocus";
import { formatCardPrice } from "../lib/formatPrice";

const HERO_CARD_IMAGE =
  "/uploads/cards/3ce2ef0e-2eaf-433a-b5c4-214706669c23.png";
const HERO_BG_IMAGE =
  "/uploads/cards/515042e3-6d20-464a-a671-b67d238b11b4.jpg";

const PRICE_BYN = 45;
const OLD_PRICE_BYN = 60;

export function PremiumHero() {
  const categoryTiles = useCategoryTiles();
  const heroArtSize = getCardArtIntrinsicSize("Marvel", categoryTiles);
  const { currency } = useCurrency();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [rx, setRx] = useState(5);
  const [ry, setRy] = useState(-10);

  const handleMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setRy(-10 + px * 14);
    setRx(5 + py * -12);
  }, []);

  const handleLeave = useCallback(() => {
    setRx(5);
    setRy(-10);
  }, []);

  return (
    <section className="relative -mx-6 mb-20 w-auto sm:-mx-10 sm:mb-28">
      {/* Cinematic background */}
      <div
        className="pointer-events-none absolute inset-0 -z-0 overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute -inset-[8%] bg-zinc-950 bg-cover bg-center opacity-90"
          style={{
            backgroundImage: `url(${HERO_BG_IMAGE})`,
            filter: "blur(48px) saturate(1.1)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black via-black/85 to-[#12051f]/95" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_40%,rgba(88,28,135,0.25),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_20%_80%,rgba(220,38,38,0.08),transparent_50%)]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-start gap-12 px-6 py-14 lg:flex-row lg:items-start lg:justify-between lg:gap-16 lg:px-10 lg:py-16">
        {/* Left copy */}
        <div className="max-w-xl flex-1 text-left">
          <p className="mb-5 inline-flex items-center rounded-full border border-red-500/35 bg-red-950/40 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-red-200/95 shadow-[0_0_24px_rgba(220,38,38,0.2)]">
            Marvel
          </p>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-white drop-shadow-[0_4px_48px_rgba(0,0,0,0.85)] sm:text-5xl md:text-6xl lg:text-[3.5rem]">
            <span className="bg-gradient-to-br from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              Призрачный Гонщик
            </span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-zinc-400 sm:text-lg">
            Легенда Marvel в премиальном формате: голография, 3D-глубина и
            огненный характер. Коллекционная карточка с эффектом присутствия —
            для тех, кто ценит редкость и кино.
          </p>

          <div className="mt-8 flex flex-wrap items-baseline gap-3">
            <span className="text-2xl font-semibold tabular-nums text-white sm:text-3xl">
              {formatCardPrice(PRICE_BYN, currency)}
            </span>
            <span className="text-lg tabular-nums text-zinc-500 line-through decoration-zinc-600 sm:text-xl">
              {formatCardPrice(OLD_PRICE_BYN, currency)}
            </span>
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="#collection"
              className="inline-flex min-h-[48px] min-w-[160px] items-center justify-center rounded-xl bg-gradient-to-b from-red-600 to-red-700 px-8 py-3.5 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(220,38,38,0.45),0_0_0_1px_rgba(0,0,0,0.2)_inset] transition hover:from-red-500 hover:to-red-600 hover:shadow-[0_12px_40px_rgba(220,38,38,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/90 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Купить
            </Link>
            <Link
              href="#collection"
              className="inline-flex min-h-[48px] min-w-[160px] items-center justify-center rounded-xl border border-white/12 bg-zinc-950/90 px-8 py-3.5 text-sm font-semibold text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-white/20 hover:bg-zinc-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Подробнее
            </Link>
          </div>
        </div>

        {/* Right: 3D card */}
        <div
          className="flex w-full max-w-2xl flex-1 justify-center lg:max-w-3xl lg:justify-end"
          style={{ perspective: "1400px" }}
        >
          <div
            ref={wrapRef}
            className="relative w-full max-w-[min(92vw,720px)] cursor-grab"
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
          >
            <div
              className="relative w-full origin-center will-change-transform transition-transform duration-300 ease-out"
              style={{
                transform: `rotateX(${rx}deg) rotateY(${ry}deg)`,
                transformStyle: "preserve-3d",
              }}
            >
              <div
                className="absolute -inset-8 rounded-[2rem] bg-gradient-to-br from-orange-600/30 via-red-600/20 to-transparent opacity-60 blur-3xl"
                aria-hidden
              />
              <div className="relative flex w-full items-start justify-center overflow-visible rounded-2xl bg-black ring-1 ring-white/20 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08)_inset,0_0_60px_rgba(220,38,38,0.15)]">
                <Image
                  src={HERO_CARD_IMAGE}
                  alt="Призрачный Гонщик — коллекционная карточка"
                  width={heroArtSize.width}
                  height={heroArtSize.height}
                  className="h-auto w-full rounded-2xl transition-all duration-300 ease-out hover:brightness-110"
                  sizes={NEXT_IMAGE_CARD_ART_SIZES}
                  priority
                  style={{
                    width: "100%",
                    height: "auto",
                    objectFit: "unset",
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/50 via-transparent to-white/10 opacity-80 mix-blend-overlay"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent"
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
