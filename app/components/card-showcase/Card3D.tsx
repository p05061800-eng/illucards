"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import type { StoredCard } from "../../api/cards/route";
import type { CardRarity } from "../../lib/cardRarityTags";
import { primaryRarityForUi } from "../../lib/cardRarityTags";
import {
  DEFAULT_CARD_ASPECT_RATIO_CSS,
  isFixedCardArtFramePreset,
  resolveCardArtBoxAspectCss,
} from "../../lib/cardAspectRatio";
import { AdultContentBlurGate } from "../AdultContentBlurGate";
import { cardRequiresAgeConfirmation } from "../../lib/cardRequiresAgeConfirmation";
import {
  cardArtFaceFitStyle,
  cardArtFaceObjectFitClass,
  cardArtFixedFrameImgClass,
  cardArtFixedFrameShellClass,
  categoryFocusCoverStyle,
} from "../../lib/imageFocus";
import { FrontHoverMotionOverlay } from "../FrontHoverMotionOverlay";
import {
  effectiveHoverMotionUrl,
  isFrontHoverVideoUrl,
} from "../../lib/frontHoverMotionUrl";
import { useCoarsePointerOrHoverNone } from "../../lib/useCoarsePointerOrHoverNone";
import { CardRarityGlowShell } from "../CardRarityGlowShell";
import { useIntrinsicImageAspect } from "../../lib/useIntrinsicImageAspect";

const RARITY_FRAME: Record<CardRarity, string> = {
  common:
    "ring-1 ring-zinc-500/45 shadow-[0_0_18px_rgba(161,161,170,0.25)] group-hover/card3d:shadow-[0_0_40px_rgba(161,161,170,0.35)]",
  limited:
    "ring-1 ring-amber-400/55 shadow-[0_0_22px_rgba(251,191,36,0.4)] group-hover/card3d:shadow-[0_0_48px_rgba(251,191,36,0.5)]",
  adult:
    "ring-1 ring-rose-400/55 shadow-[0_0_22px_rgba(244,63,94,0.4)] group-hover/card3d:shadow-[0_0_48px_rgba(244,63,94,0.5)]",
  replica:
    "ring-1 ring-sky-400/55 shadow-[0_0_22px_rgba(56,189,248,0.4)] group-hover/card3d:shadow-[0_0_48px_rgba(56,189,248,0.5)]",
  novelty:
    "ring-1 ring-emerald-400/55 shadow-[0_0_22px_rgba(52,211,153,0.4)] group-hover/card3d:shadow-[0_0_48px_rgba(52,211,153,0.5)]",
  hot_price:
    "ring-1 ring-fuchsia-400/70 shadow-[0_0_30px_rgba(217,70,239,0.52)] group-hover/card3d:ring-fuchsia-300/85 animate-legendary-card",
};

const RARITY_CORNER_BADGE: Record<CardRarity, string> = {
  common:
    "border-zinc-500/60 bg-zinc-900/95 text-zinc-200 shadow-[0_0_12px_rgba(161,161,170,0.35)]",
  limited:
    "border-amber-400/70 bg-amber-950/90 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.5)]",
  adult:
    "border-rose-400/70 bg-rose-950/90 text-rose-100 shadow-[0_0_14px_rgba(244,63,94,0.55)]",
  replica:
    "border-sky-400/70 bg-sky-950/90 text-sky-100 shadow-[0_0_14px_rgba(56,189,248,0.5)]",
  novelty:
    "border-emerald-400/70 bg-emerald-950/90 text-emerald-100 shadow-[0_0_14px_rgba(52,211,153,0.55)]",
  hot_price:
    "border-fuchsia-400/80 bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white shadow-[0_0_16px_rgba(217,70,239,0.65)]",
};

const RARITY_CORNER_SHORT: Record<CardRarity, string> = {
  common: "Обыч",
  limited: "Лим",
  adult: "18+",
  replica: "Реп",
  novelty: "Нов",
  hot_price: "🔥",
};

const RARITY_LABELS: Record<CardRarity, string> = {
  common: "Обычная",
  limited: "Лимитированная",
  adult: "18+",
  replica: "Реплики",
  novelty: "Новинки",
  hot_price: "Горячая цена",
};

const PARTICLE_RGB: Record<CardRarity, { r: number; g: number; b: number }> = {
  common: { r: 161, g: 161, b: 170 },
  limited: { r: 255, g: 200, b: 80 },
  adult: { r: 255, g: 80, b: 120 },
  replica: { r: 56, g: 189, b: 248 },
  novelty: { r: 52, g: 211, b: 153 },
  hot_price: { r: 217, g: 70, b: 239 },
};

const CURSOR_GLOW: Record<CardRarity, string> = {
  common: "radial-gradient(circle, rgba(161,161,170,0.3), transparent 70%)",
  limited: "radial-gradient(circle, rgba(251,191,36,0.35), transparent 70%)",
  adult: "radial-gradient(circle, rgba(244,63,94,0.35), transparent 70%)",
  replica:
    "radial-gradient(circle, rgba(56,189,248,0.35), transparent 70%)",
  novelty: "radial-gradient(circle, rgba(52,211,153,0.35), transparent 70%)",
  hot_price:
    "radial-gradient(circle, rgba(217,70,239,0.4), transparent 70%)",
};

const SHINE_IDLE =
  "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.4), transparent 70%)";

const TILT_LIGHT_IDLE =
  "radial-gradient(circle at center, rgba(255,255,255,0.2), transparent 60%)";

const MAGNETIC_STRENGTH = 0.1;

/** Из `public/sounds/` — URL с корня сайта */
const HOVER_SOUND_SRC = "/sounds/hover.mp3";

function safeImage(src: unknown): string | null {
  if (src === null || src === undefined) return null;
  if (typeof src !== "string") return null;
  const t = src.trim();
  return t.length > 0 ? t : null;
}

function ImagePlaceholder({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute inset-0 rounded-2xl bg-gradient-to-br from-zinc-800 to-purple-950/50 ring-1 ring-purple-500/20 ${className}`}
      aria-hidden
    />
  );
}

type Props = {
  card: StoredCard;
};

export function Card3D({ card }: Props) {
  const frontSrc = safeImage(card.frontImage);
  const faceCls = cardArtFaceObjectFitClass(card.cardArtFramePreset);
  const fixedCatalogFrame = isFixedCardArtFramePreset(card.cardArtFramePreset);
  const fixedShell = cardArtFixedFrameShellClass(fixedCatalogFrame);
  const fixedImg = cardArtFixedFrameImgClass(fixedCatalogFrame);
  const { aspectRatioCss: spacerIntrinsicCss } = useIntrinsicImageAspect(
    frontSrc || undefined,
  );
  const stackBoxAspectCss = resolveCardArtBoxAspectCss(
    card,
    spacerIntrinsicCss,
    null,
  );
  const cardFaceShellClass = fixedCatalogFrame
    ? fixedShell
    : "absolute inset-0 overflow-hidden rounded-2xl bg-black";
  const rarity = primaryRarityForUi(card);
  const magneticRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorGlowRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hoverMotionVideoRef = useRef<HTMLVideoElement | null>(null);
  const shineRef = useRef<HTMLDivElement>(null);
  const tiltLightRef = useRef<HTMLDivElement>(null);
  const flippedRef = useRef(false);
  const hoveringRef = useRef(false);
  const lastPointerRef = useRef<{ clientX: number; clientY: number } | null>(
    null
  );
  const mouseMoveRafRef = useRef(0);
  const pendingMouseRef = useRef<{ clientX: number; clientY: number } | null>(
    null
  );

  const [flipped, setFlipped] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const coarsePointerOrHoverNone = useCoarsePointerOrHoverNone();

  useEffect(() => {
    flippedRef.current = flipped;
  }, [flipped]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const fn = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  /** Без :hover (телефон) — подстраховка `play()` (плюс `autoPlay` на `<video>`). */
  useEffect(() => {
    if (reduceMotion) return;
    const hm = effectiveHoverMotionUrl(card.frontHoverGif);
    if (!hm || !isFrontHoverVideoUrl(hm)) return;
    if (!coarsePointerOrHoverNone) return;
    const id = requestAnimationFrame(() => {
      void hoverMotionVideoRef.current?.play()?.catch(() => {});
    });
    return () => cancelAnimationFrame(id);
  }, [reduceMotion, card.frontHoverGif, card.id, coarsePointerOrHoverNone]);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- отладка пути к hover-звуку
      console.log("audio path:", HOVER_SOUND_SRC);
    }
    const el = audioRef.current;
    if (el) {
      el.load();
    }
  }, []);

  const playHover = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const canvas = canvasRef.current;
    const wrap = wrapperRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const rgb = PARTICLE_RGB[rarity];
    const PARTICLE_COUNT = 22;

    function createParticle(w: number, h: number) {
      return {
        x: Math.random() * w,
        y: h + 10,
        size: Math.random() * 3 + 1,
        speedY: Math.random() * 1.5 + 0.5,
        speedX: (Math.random() - 0.5) * 1,
        opacity: Math.random(),
      };
    }

    let particles: ReturnType<typeof createParticle>[] = [];
    let raf = 0;
    let runParticles = false;

    function resize() {
      if (!wrap || !canvas) return;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      canvas.width = w;
      canvas.height = h;
      particles = Array.from({ length: PARTICLE_COUNT }, () =>
        createParticle(w, h)
      );
    }

    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(wrap);

    function animate() {
      if (!runParticles || !canvas || !ctx || document.hidden) {
        raf = 0;
        return;
      }
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.y -= p.speedY;
        p.x += p.speedX;
        p.opacity -= 0.005;
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        if (p.opacity <= 0) {
          Object.assign(p, createParticle(w, h));
        }
      });
      raf = requestAnimationFrame(animate);
    }

    function startLoop() {
      if (raf !== 0 || document.hidden) return;
      raf = requestAnimationFrame(animate);
    }

    function stopLoop() {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        const vis = Boolean(entry?.isIntersecting);
        if (vis) {
          runParticles = true;
          startLoop();
        } else {
          runParticles = false;
          stopLoop();
        }
      },
      { root: null, rootMargin: "80px", threshold: 0 }
    );
    io.observe(wrap);

    const onVisibility = () => {
      if (document.hidden) {
        stopLoop();
      } else if (runParticles) {
        startLoop();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    runParticles = true;
    startLoop();

    return () => {
      runParticles = false;
      stopLoop();
      document.removeEventListener("visibilitychange", onVisibility);
      io.disconnect();
      ro.disconnect();
    };
  }, [reduceMotion, rarity]);

  const applyTilt = useCallback(
    (clientX: number, clientY: number) => {
      const wrap = wrapperRef.current;
      const card = cardRef.current;
      if (!wrap || !card || reduceMotion) return;

      const rect = wrap.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const rotateX = -(y - rect.height / 2) / 12;
      const rotateY = (x - rect.width / 2) / 12;
      const baseY = flippedRef.current ? 180 : 0;
      const ry = baseY + rotateY;
      card.style.transform = `rotateY(${ry}deg) rotateX(${rotateX}deg)`;

      if (shineRef.current) {
        const angle = (x / rect.width) * 180;
        shineRef.current.style.background = `linear-gradient(${angle}deg, transparent 30%, rgba(255,255,255,0.5), transparent 70%)`;
      }
      if (tiltLightRef.current) {
        const px = (x / rect.width) * 100;
        const py = (y / rect.height) * 100;
        tiltLightRef.current.style.background = `radial-gradient(circle at ${px}% ${py}%, rgba(255,255,255,0.2), transparent 60%)`;
      }
    },
    [reduceMotion]
  );

  useLayoutEffect(() => {
    if (!cardRef.current) return;
    if (reduceMotion) {
      cardRef.current.style.transform = flipped
        ? "rotateY(180deg)"
        : "rotateY(0deg)";
      return;
    }
    if (lastPointerRef.current) {
      applyTilt(
        lastPointerRef.current.clientX,
        lastPointerRef.current.clientY
      );
      return;
    }
    cardRef.current.style.transform = flipped
      ? "rotateY(180deg)"
      : "rotateY(0deg)";
  }, [flipped, reduceMotion, applyTilt]);

  const flushMouseMove = useCallback(() => {
    mouseMoveRafRef.current = 0;
    const p = pendingMouseRef.current;
    if (!p || reduceMotion) return;
    lastPointerRef.current = p;
    applyTilt(p.clientX, p.clientY);

    const wrap = wrapperRef.current;
    const mag = magneticRef.current;
    const glow = cursorGlowRef.current;
    if (wrap) {
      const rect = wrap.getBoundingClientRect();
      if (mag) {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distX = p.clientX - centerX;
        const distY = p.clientY - centerY;
        mag.style.transform = `translate(${distX * MAGNETIC_STRENGTH}px, ${distY * MAGNETIC_STRENGTH}px)`;
      }
      if (glow) {
        const ox = p.clientX - rect.left;
        const oy = p.clientY - rect.top;
        glow.style.left = `${ox - 80}px`;
        glow.style.top = `${oy - 80}px`;
        glow.style.opacity = "1";
      }
    }
  }, [reduceMotion, applyTilt]);

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (reduceMotion) return;
      pendingMouseRef.current = { clientX: e.clientX, clientY: e.clientY };
      if (mouseMoveRafRef.current !== 0) {
        cancelAnimationFrame(mouseMoveRafRef.current);
      }
      mouseMoveRafRef.current = requestAnimationFrame(flushMouseMove);
    },
    [reduceMotion, flushMouseMove]
  );

  useEffect(
    () => () => {
      if (mouseMoveRafRef.current !== 0) {
        cancelAnimationFrame(mouseMoveRafRef.current);
      }
    },
    []
  );

  const handleMouseEnter = () => {
    hoveringRef.current = true;
    void hoverMotionVideoRef.current?.play()?.catch(() => {});
    if (reduceMotion) return;
    playHover();
    if (cursorGlowRef.current) {
      cursorGlowRef.current.style.opacity = "1";
    }
  };

  const handleMouseLeave = () => {
    hoveringRef.current = false;
    const hv = hoverMotionVideoRef.current;
    if (hv) {
      hv.pause();
      hv.currentTime = 0;
    }
    pendingMouseRef.current = null;
    if (mouseMoveRafRef.current !== 0) {
      cancelAnimationFrame(mouseMoveRafRef.current);
      mouseMoveRafRef.current = 0;
    }
    lastPointerRef.current = null;
    if (magneticRef.current) {
      magneticRef.current.style.transform = "translate(0px, 0px)";
    }
    if (cursorGlowRef.current) {
      cursorGlowRef.current.style.opacity = "0";
    }
    if (!cardRef.current || reduceMotion) return;
    cardRef.current.style.transform = flipped
      ? "rotateY(180deg)"
      : "rotateY(0deg)";
    if (shineRef.current) {
      shineRef.current.style.background = SHINE_IDLE;
      shineRef.current.style.mixBlendMode = "overlay";
    }
    if (tiltLightRef.current) {
      tiltLightRef.current.style.background = TILT_LIGHT_IDLE;
    }
  };

  const toggleFlip = () => {
    setFlipped((prev) => !prev);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleFlip();
    }
  };

  const backSrc = safeImage(card.backImage);
  const hoverVideoSrc = effectiveHoverMotionUrl(card.frontHoverGif);
  const canFlip =
    (card.effect === "vario" || card.effect === "morphing") &&
    Boolean(backSrc);

  const hoverMotionLayerClass = coarsePointerOrHoverNone
    ? "pointer-events-none absolute inset-0 z-[5] flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-2xl bg-black opacity-100 transition-opacity duration-200 motion-reduce:opacity-0"
    : [
        "pointer-events-none absolute inset-0 z-[5] flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-2xl bg-black",
        "opacity-100 transition-opacity duration-200 motion-reduce:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover/card3d:opacity-100",
      ].join(" ");

  return (
    <article className="group/card3d mx-auto w-full max-w-[min(100%,380px)]">
      <CardRarityGlowShell
        rarity={rarity}
        frameClassName={`relative z-10 overflow-visible rounded-2xl ring-1 transition-[box-shadow] duration-500 ease-out ${RARITY_FRAME[rarity]}`}
      >
        <div
          className={`mx-auto inline-block max-w-full ${
            reduceMotion ? "" : "animate-card-float"
          }`}
        >
          <div
            ref={magneticRef}
            className="transition-transform duration-200 ease-out will-change-transform"
          >
            <AdultContentBlurGate
              isAdult={cardRequiresAgeConfirmation(card)}
              cardId={card.id}
            >
            <div
              className="relative mx-auto w-full max-w-[min(100%,380px)]"
              style={{ width: "min(320px, calc(100% - 2rem))" }}
            >
              {frontSrc ? (
                <div
                  aria-hidden
                  className="invisible block w-full max-w-full rounded-2xl"
                  style={{ aspectRatio: stackBoxAspectCss }}
                />
              ) : (
                <div
                  className="w-full rounded-2xl bg-gradient-to-br from-zinc-800 to-purple-950/50"
                  style={{ aspectRatio: DEFAULT_CARD_ASPECT_RATIO_CSS }}
                  aria-hidden
                />
              )}
              <div
                ref={wrapperRef}
                role={canFlip ? "button" : undefined}
                tabIndex={canFlip ? 0 : undefined}
                aria-label={
                  canFlip
                    ? `${card.title}. Нажмите, чтобы перевернуть.`
                    : card.title
                }
                aria-pressed={canFlip ? flipped : undefined}
                className={`absolute inset-0 z-10 perspective-[1400px] touch-manipulation selection:bg-transparent ${
                  canFlip ? "cursor-pointer" : "cursor-default"
                }`}
                onMouseEnter={handleMouseEnter}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={canFlip ? toggleFlip : undefined}
                onKeyDown={canFlip ? onKeyDown : undefined}
              >
              <audio
                ref={audioRef}
                src={HOVER_SOUND_SRC}
                preload="auto"
                aria-hidden
              />

              <div
                ref={cardRef}
                className="absolute inset-0 z-10 transition-transform duration-500 ease-out will-change-transform [transform-style:preserve-3d]"
                data-cart-fly-source
              >
                <div
                  className="pointer-events-none absolute inset-0 z-0 rounded-2xl shadow-[0_0_40px_rgba(255,50,50,0.22)]"
                  aria-hidden
                />

                <div
                  className={`absolute inset-0 z-[1] overflow-visible rounded-2xl bg-black [backface-visibility:hidden] ${cardFaceShellClass}`}
                >
                  <span
                    className={`pointer-events-none absolute right-3 top-3 z-20 flex h-8 min-w-[2rem] items-center justify-center rounded-md border px-2 text-xs font-extrabold uppercase leading-none backdrop-blur-sm ${RARITY_CORNER_BADGE[rarity]}`}
                    title={RARITY_LABELS[rarity]}
                  >
                    {RARITY_CORNER_SHORT[rarity]}
                  </span>
                  {frontSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={frontSrc}
                      alt={`${card.title} — лицевая сторона`}
                      className={`${
                        fixedCatalogFrame
                          ? `${fixedImg} rounded-2xl ${faceCls}`
                          : `h-full w-full object-cover rounded-2xl ${faceCls}`
                      }${
                        hoverVideoSrc && !reduceMotion && !coarsePointerOrHoverNone
                          ? " opacity-0 transition-opacity duration-200 [@media(hover:hover)_and_(pointer:fine)]:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover/card3d:opacity-0"
                          : ""
                      }`}
                      style={
                        fixedCatalogFrame
                          ? cardArtFaceFitStyle(
                              card.cardArtFramePreset,
                              card.frontImageFocus,
                            )
                          : categoryFocusCoverStyle(card.frontImageFocus)
                      }
                      draggable={false}
                      decoding="async"
                    />
                  ) : (
                    <ImagePlaceholder />
                  )}
                  {hoverVideoSrc && !reduceMotion ? (
                    <FrontHoverMotionOverlay
                      url={hoverVideoSrc}
                      videoRef={hoverMotionVideoRef}
                      className={hoverMotionLayerClass}
                      style={
                        fixedCatalogFrame
                          ? cardArtFaceFitStyle(
                              card.cardArtFramePreset,
                              card.frontImageFocus,
                            )
                          : categoryFocusCoverStyle(card.frontImageFocus)
                      }
                      fillFaceFrame={!fixedCatalogFrame}
                      autoPlay={coarsePointerOrHoverNone}
                    />
                  ) : null}
                </div>

                <div
                  className={`absolute inset-0 z-[1] overflow-visible rounded-2xl bg-black [backface-visibility:hidden] [transform:rotateY(180deg)] ${cardFaceShellClass}`}
                >
                  {backSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={backSrc}
                      alt={`${card.title} — оборот`}
                      className={
                        fixedCatalogFrame
                          ? `${fixedImg} rounded-2xl ${faceCls}`
                          : `h-full w-full object-cover rounded-2xl ${faceCls}`
                      }
                      style={
                        fixedCatalogFrame
                          ? cardArtFaceFitStyle(
                              card.cardArtFramePreset,
                              card.backImageFocus,
                            )
                          : categoryFocusCoverStyle(card.backImageFocus)
                      }
                      draggable={false}
                      decoding="async"
                    />
                  ) : (
                    <ImagePlaceholder />
                  )}
                </div>

                {!reduceMotion ? (
                  <>
                    <div
                      ref={shineRef}
                      className="pointer-events-none absolute inset-0 z-[2] rounded-2xl"
                      style={{
                        background: SHINE_IDLE,
                        mixBlendMode: "overlay",
                      }}
                      aria-hidden
                    />
                    <div
                      ref={tiltLightRef}
                      className="pointer-events-none absolute inset-0 z-[3] rounded-2xl"
                      style={{ background: TILT_LIGHT_IDLE }}
                      aria-hidden
                    />
                  </>
                ) : null}
              </div>

              {!reduceMotion ? (
                <>
                  <canvas
                    ref={canvasRef}
                    className="pointer-events-none absolute inset-0 z-20"
                    aria-hidden
                  />
                  <div
                    ref={cursorGlowRef}
                    className="pointer-events-none absolute z-[21] h-40 w-40 rounded-full opacity-0 transition-opacity duration-200"
                    style={{
                      background: CURSOR_GLOW[rarity],
                      filter: "blur(40px)",
                      left: 0,
                      top: 0,
                    }}
                    aria-hidden
                  />
                </>
              ) : null}
              </div>
            </div>
            </AdultContentBlurGate>
          </div>
        </div>
      </CardRarityGlowShell>
    </article>
  );
}
