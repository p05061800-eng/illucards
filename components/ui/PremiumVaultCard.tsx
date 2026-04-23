"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { StoredCard } from "@/app/api/cards/route";
import { useIntrinsicImageAspect } from "@/app/lib/useIntrinsicImageAspect";
import { getCategoryBackgroundUrl } from "@/app/lib/categoryBackground";
import {
  resolveCardArtBoxAspectCss,
} from "@/app/lib/cardAspectRatio";
import {
  cardArtFaceFitStyle,
  cardArtFaceObjectFitClass,
  categoryFocusContainStyle,
  NEXT_IMAGE_CARD_ART_SIZES,
} from "@/app/lib/imageFocus";

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const MAX_TILT = 10;
/** Порог: не трогаем DOM при изменении меньше этого (градусы / % glare) */
const EPS = 0.08;

type Props = {
  card: StoredCard;
  className?: string;
  /** Плавающие контролы (избранное и т.д.) поверх лица карты */
  overlay?: ReactNode;
};

function safeSrc(src: unknown): string | null {
  if (typeof src !== "string") return null;
  const t = src.trim();
  return t.length > 0 ? t : null;
}

/**
 * Премиальная витринная карточка: слои ultra → category → back → glow → front + блик и 3D-наклон.
 */
export function PremiumVaultCard({ card, className, overlay }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tiltInnerRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const pendingPointerRef = useRef<{ cx: number; cy: number } | null>(null);
  const rafRef = useRef(0);
  const hoverRef = useRef(false);
  const lastHoverForApplyRef = useRef(false);
  const lastAppliedRef = useRef({
    rx: 0,
    ry: 0,
    gx: 50,
    gy: 50,
  });
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const fn = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(
    () => () => {
      if (rafRef.current !== 0) {
        cancelAnimationFrame(rafRef.current);
      }
    },
    []
  );

  const applyPointer = useCallback(() => {
    rafRef.current = 0;
    const p = pendingPointerRef.current;
    const root = rootRef.current;
    const tilt = tiltInnerRef.current;
    const glare = glareRef.current;
    if (!p || !root || !tilt || !glare || reduceMotion) return;

    const r = root.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;

    const px = (p.cx - r.left) / r.width;
    const py = (p.cy - r.top) / r.height;
    const nx = (px - 0.5) * 2;
    const ny = (py - 0.5) * 2;
    const ry = Math.max(-MAX_TILT, Math.min(MAX_TILT, nx * MAX_TILT));
    const rx = Math.max(-MAX_TILT, Math.min(MAX_TILT, -ny * MAX_TILT));
    const gx = px * 100;
    const gy = py * 100;

    const la = lastAppliedRef.current;
    const hover = hoverRef.current;
    const hoverChanged = hover !== lastHoverForApplyRef.current;
    lastHoverForApplyRef.current = hover;
    if (
      !hoverChanged &&
      Math.abs(la.rx - rx) < EPS &&
      Math.abs(la.ry - ry) < EPS &&
      Math.abs(la.gx - gx) < EPS &&
      Math.abs(la.gy - gy) < EPS
    ) {
      return;
    }
    la.rx = rx;
    la.ry = ry;
    la.gx = gx;
    la.gy = gy;

    tilt.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
    glare.style.opacity = hover ? "0.5" : "0";
    glare.style.background = `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.06) 32%, transparent 58%)`;
  }, [reduceMotion]);

  const schedulePointer = useCallback(
    (cx: number, cy: number) => {
      pendingPointerRef.current = { cx, cy };
      if (rafRef.current !== 0) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(applyPointer);
    },
    [applyPointer]
  );

  const onMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (reduceMotion) return;
      schedulePointer(e.clientX, e.clientY);
    },
    [reduceMotion, schedulePointer]
  );

  const onEnter = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      hoverRef.current = true;
      schedulePointer(e.clientX, e.clientY);
    },
    [schedulePointer]
  );

  const onLeave = useCallback(() => {
    hoverRef.current = false;
    lastHoverForApplyRef.current = false;
    pendingPointerRef.current = null;
    if (rafRef.current !== 0) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    lastAppliedRef.current = { rx: 0, ry: 0, gx: 50, gy: 50 };
    const tilt = tiltInnerRef.current;
    const glare = glareRef.current;
    if (tilt) {
      tilt.style.transform =
        "rotateX(0deg) rotateY(0deg) translateZ(0)";
    }
    if (glare) {
      glare.style.opacity = "0";
      glare.style.background =
        "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.06) 32%, transparent 58%)";
    }
  }, []);

  const front = safeSrc(card.frontImage);
  const { aspectRatioCss: loadedAspectCss } = useIntrinsicImageAspect(
    card.frontImageWidth && card.frontImageHeight ? undefined : front ?? "",
  );
  const boxAspectRatioCss = resolveCardArtBoxAspectCss(
    card,
    loadedAspectCss,
    null,
  );
  const faceCls = cardArtFaceObjectFitClass(card.cardArtFramePreset);
  const back = safeSrc(card.backImage);
  const categoryUrl =
    card.categoryBg?.trim() || getCategoryBackgroundUrl(card.category);
  const ultraImg = card.ultraBg?.trim() || card.heroBg?.trim() || null;
  const gradientExtras = card.bg?.trim()
    ? card.bg.trim()
    : "from-violet-950/35 via-[#08060f] to-fuchsia-950/25";

  if (!front) {
    return (
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 to-purple-950/40 ring-1 ring-white/10",
          className
        )}
        style={{ aspectRatio: boxAspectRatioCss }}
      >
        <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
          Нет изображения
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={cn("[perspective:1200px]", className)}
      onMouseMove={onMove}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div
        ref={tiltInnerRef}
        className="relative w-full origin-center transition-transform duration-300 ease-out will-change-transform [transform-style:preserve-3d]"
        style={{
          aspectRatio: boxAspectRatioCss,
          ...(reduceMotion
            ? {}
            : { transform: "rotateX(0deg) rotateY(0deg) translateZ(0)" }),
        }}
      >
        {/* Ultra: мягкий градиент + опционально дальний кадр */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl bg-black shadow-[0_20px_48px_rgba(0,0,0,0.35)] [transform:translateZ(-12px)]">
          {ultraImg ? (
            <Image
              src={ultraImg}
              alt=""
              fill
              className={cn(
                "rounded-2xl object-contain opacity-50 saturate-110",
                faceCls,
              )}
              sizes={NEXT_IMAGE_CARD_ART_SIZES}
              style={categoryFocusContainStyle(null)}
            />
          ) : null}
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-br opacity-95",
              gradientExtras
            )}
          />
        </div>

        {/* Category: лёгкий наклон, без тяжёлого затемнения */}
        {categoryUrl ? (
          <div className="absolute inset-[-6%] flex items-center justify-center overflow-hidden rounded-2xl bg-black opacity-[0.72] [transform:translateZ(-6px)_rotate(-9deg)]">
            <Image
              src={categoryUrl}
              alt=""
              fill
              className={cn("rounded-2xl object-contain", faceCls)}
              style={categoryFocusContainStyle(card.categoryBgFocus)}
              sizes={NEXT_IMAGE_CARD_ART_SIZES}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
          </div>
        ) : null}

        {/* Мягкое свечение между слоями — одна тень */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-70 [transform:translateZ(4px)] [box-shadow:0_0_36px_rgba(139,92,246,0.14)]"
          aria-hidden
        />

        {/* Back: лёгкое размытие глубины */}
        {back ? (
          <div className="absolute inset-[5%] flex items-center justify-center overflow-hidden rounded-2xl opacity-[0.58] [transform:translateZ(8px)_rotate(-2deg)]">
            <Image
              src={back}
              alt=""
              fill
              className={cn("rounded-2xl blur-sm", faceCls)}
              style={cardArtFaceFitStyle(
                card.cardArtFramePreset,
                card.backImageFocus,
              )}
              sizes={NEXT_IMAGE_CARD_ART_SIZES}
            />
          </div>
        ) : null}

        {/* Front */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl [transform:translateZ(18px)]">
          <Image
            src={front}
            alt={card.title}
            fill
            priority={false}
            className={cn("rounded-2xl", faceCls)}
            style={cardArtFaceFitStyle(
              card.cardArtFramePreset,
              card.frontImageFocus,
            )}
            sizes={NEXT_IMAGE_CARD_ART_SIZES}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/18 via-transparent to-white/[0.06]" />
        </div>

        {/* Glare — позиция и opacity обновляются через ref в requestAnimationFrame */}
        <div
          ref={glareRef}
          className="pointer-events-none absolute inset-0 z-[25] overflow-hidden rounded-2xl mix-blend-overlay transition-opacity duration-300 ease-out [transform:translateZ(22px)]"
          style={{
            opacity: 0,
            background:
              "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.06) 32%, transparent 58%)",
          }}
          aria-hidden
        />

        {overlay ? (
          <div className="absolute inset-0 z-[40] [transform:translateZ(28px)]">
            {overlay}
          </div>
        ) : null}
      </div>
    </div>
  );
}
