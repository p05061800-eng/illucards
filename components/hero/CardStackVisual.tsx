"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { StoredCard } from "@/app/api/cards/route";
import { focusToStyle } from "@/app/lib/imageFocus";

const HOLO_GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.45'/%3E%3C/svg%3E\")";

const HALFTONE_BG = `radial-gradient(circle, rgba(255,255,255,0.14) 0.7px, transparent 1.1px)`;

export type CardStackVisualProps = {
  card: StoredCard;
  ultraBgUrl: string;
  /** Корневой блок aspect-[3/4] (ширина героя vs каталога) */
  rootClassName?: string;
  /** Усиленный выступ 3-го слоя слева/снизу — только для сетки каталога */
  catalogStack?: boolean;
  /** Герой: компенсация сдвига слоя .card-side влево — визуальное центрирование */
  heroStack?: boolean;
  /** Без третьего слоя (ultra наискосок) — только в сетке коллекции на главной */
  hideUltraLayer?: boolean;
  overlay?: ReactNode;
  dataCartFlySource?: boolean;
};

/**
 * Та же стопка, что на главном герое: слой 3 (.card-side) → vario (лицо/оборот по X) + tilt.
 */
export function CardStackVisual({
  card,
  ultraBgUrl,
  rootClassName = "relative mx-auto aspect-[3/4] w-full overflow-visible rounded-2xl",
  catalogStack = false,
  heroStack = false,
  hideUltraLayer = false,
  overlay,
  dataCartFlySource,
}: CardStackVisualProps) {
  const tiltZoneRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const holoGlareRef = useRef<HTMLDivElement>(null);
  const cardBackRef = useRef<HTMLDivElement>(null);
  const cardFrontRef = useRef<HTMLDivElement>(null);
  const lenticularRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const pendingRef = useRef<{ cx: number; cy: number } | null>(null);
  const reduceMotionRef = useRef(false);
  /** На главной с тачем: не тянуть 3D-наклон — только vario (меньше лагов) */
  const coarseTouchHeroRef = useRef(false);

  /** Две разные картинки → варио в каталоге и герое (не только при effect===vario в JSON). */
  const hasVario = useMemo(() => {
    const f = card.frontImage?.trim() ?? "";
    const b = card.backImage?.trim() ?? "";
    return Boolean(f && b && b !== f);
  }, [card.frontImage, card.backImage]);

  /** Каталог: умеренный наклон (много карточек); герой — сильнее. */
  const maxTilt = catalogStack ? 10 : 17;
  const idleTranslateZ = catalogStack ? 4 : 8;

  const interactiveTilt = true;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotionRef.current = mq.matches;
    const fn = () => {
      reduceMotionRef.current = mq.matches;
    };
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => {
    if (!heroStack) {
      coarseTouchHeroRef.current = false;
      return;
    }
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const sync = () => {
      coarseTouchHeroRef.current = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [heroStack]);

  useEffect(
    () => () => {
      if (rafRef.current !== 0) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const applyTilt = useCallback(() => {
    rafRef.current = 0;
    const zone = tiltZoneRef.current;
    const holoGlare = holoGlareRef.current;
    const p = pendingRef.current;
    if (!zone || !p) return;

    const r = zone.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;

    const px = (p.cx - r.left) / r.width;
    const py = (p.cy - r.top) / r.height;
    const nx = (px - 0.5) * 2;
    const ny = (py - 0.5) * 2;

    // Vario: переключение лицо/оборот по X — работает и при «уменьшить движение», и на таче
    if (hasVario) {
      const mouseX = Math.min(1, Math.max(0, px));
      const back = cardBackRef.current;
      const front = cardFrontRef.current;
      if (back) back.style.opacity = String(mouseX);
      if (front) front.style.opacity = String(1 - mouseX);
      const lent = lenticularRef.current;
      const liteLenticular =
        heroStack && coarseTouchHeroRef.current ? false : true;
      if (lent && !reduceMotionRef.current && liteLenticular) {
        lent.style.setProperty("--lenticular-x", String(px));
        lent.style.setProperty("--lenticular-y", String(py));
      }
    }

    const tilt = tiltRef.current;
    const skip3dTilt =
      reduceMotionRef.current ||
      (heroStack && coarseTouchHeroRef.current && hasVario);
    if (skip3dTilt || !tilt) {
      if (tilt && skip3dTilt) {
        tilt.style.transform = `rotateX(0deg) rotateY(0deg) translateZ(${idleTranslateZ}px)`;
      }
      if (holoGlare && skip3dTilt) {
        holoGlare.style.opacity = "0";
      }
      return;
    }

    const ry = Math.max(-maxTilt, Math.min(maxTilt, nx * maxTilt));
    const rx = Math.max(-maxTilt, Math.min(maxTilt, -ny * maxTilt));

    const tiltMag =
      maxTilt > 0 ? Math.sqrt(rx * rx + ry * ry) / maxTilt : 0;
    const z = idleTranslateZ + tiltMag * (catalogStack ? 14 : 22);
    tilt.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(${z}px)`;

    if (holoGlare) {
      holoGlare.style.opacity = String(Math.min(0.65, 0.22 + tiltMag * 0.45));
      holoGlare.style.backgroundImage = `linear-gradient(118deg, transparent 28%, rgba(255,255,255,0.2) 50%, transparent 72%)`;
      holoGlare.style.backgroundSize = "220% 220%";
      holoGlare.style.backgroundPosition = `${20 + px * 55}% ${16 + py * 60}%`;
      holoGlare.style.mixBlendMode = "soft-light";
      holoGlare.style.transition = "none";
    }
  }, [hasVario, maxTilt, idleTranslateZ, catalogStack, heroStack]);

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      /* iOS шлёт и pointer, и touch — движение обрабатывают touch listeners */
      if (heroStack && e.pointerType === "touch") return;
      pendingRef.current = { cx: e.clientX, cy: e.clientY };
      if (rafRef.current !== 0) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(applyTilt);
    },
    [applyTilt, heroStack]
  );

  const onPointerEnter = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (heroStack && e.pointerType === "touch") return;
      pendingRef.current = { cx: e.clientX, cy: e.clientY };
      if (rafRef.current !== 0) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(applyTilt);
    },
    [applyTilt, heroStack]
  );

  /**
   * На тач-экранах без захвата указателя pointermove часто не идёт непрерывно.
   * В герое `<Link>` оборачивает стопку: захват + `touch-action: none` в WebKit/Telegram
   * часто глушат синтез `click` и переход по ссылке — захват только в каталоге/сетке.
   */
  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!heroStack && (e.pointerType === "touch" || e.pointerType === "pen")) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    pendingRef.current = { cx: e.clientX, cy: e.clientY };
    if (rafRef.current !== 0) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(applyTilt);
  }, [applyTilt, heroStack]);

  const onPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!heroStack && (e.pointerType === "touch" || e.pointerType === "pen")) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  }, [heroStack]);

  /** Сброс наклона/vario после ухода курсора или при смене карточки (без remount всего стека). */
  const resetInteractiveState = useCallback(() => {
    pendingRef.current = null;
    if (rafRef.current !== 0) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const tilt = tiltRef.current;
    const holoGlare = holoGlareRef.current;
    if (tilt) {
      tilt.style.transform = `rotateX(0deg) rotateY(0deg) translateZ(${idleTranslateZ}px)`;
    }
    if (holoGlare) {
      holoGlare.style.opacity = "0";
      holoGlare.style.backgroundPosition = "50% 50%";
    }

    if (cardBackRef.current) cardBackRef.current.style.opacity = "0";
    if (cardFrontRef.current) cardFrontRef.current.style.opacity = "1";
    if (lenticularRef.current) {
      lenticularRef.current.style.setProperty("--lenticular-x", "0.5");
      lenticularRef.current.style.setProperty("--lenticular-y", "0.5");
    }
  }, [idleTranslateZ]);

  const onPointerLeave = useCallback(() => {
    resetInteractiveState();
  }, [resetInteractiveState]);

  useLayoutEffect(() => {
    resetInteractiveState();
  }, [card.id, resetInteractiveState]);

  /**
   * Vario на телефоне: без pointer capture в герое `pointermove` в WebKit часто не идёт
   * во время жеста. Нативные touch-события дают координаты; passive — не блокируем клик по Link.
   */
  useEffect(() => {
    if (!hasVario) return;
    const el = tiltZoneRef.current;
    if (!el) return;

    const syncFromTouch = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const t = e.touches[0];
      pendingRef.current = { cx: t.clientX, cy: t.clientY };
      if (rafRef.current !== 0) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(applyTilt);
    };

    const syncFromTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!t) return;
      pendingRef.current = { cx: t.clientX, cy: t.clientY };
      if (rafRef.current !== 0) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(applyTilt);
    };

    el.addEventListener("touchstart", syncFromTouch, { passive: true });
    el.addEventListener("touchmove", syncFromTouch, { passive: true });
    el.addEventListener("touchend", syncFromTouchEnd, { passive: true });
    el.addEventListener("touchcancel", syncFromTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", syncFromTouch);
      el.removeEventListener("touchmove", syncFromTouch);
      el.removeEventListener("touchend", syncFromTouchEnd);
      el.removeEventListener("touchcancel", syncFromTouchEnd);
    };
  }, [hasVario, applyTilt, card.id]);

  const front = card.frontImage?.trim();
  if (!front) return null;

  const back = card.backImage?.trim() ?? "";
  const frontPosStyle = focusToStyle(card.frontImageFocus);
  const backPosStyle = focusToStyle(card.backImageFocus);

  return (
    <div
      className={[
        rootClassName,
        catalogStack
          ? "catalog-card-stack overflow-visible [contain:layout]"
          : "",
        heroStack ? "hero-card-stack-visual" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...(dataCartFlySource ? { "data-cart-fly-source": true } : {})}
    >
      {!hideUltraLayer ? (
        <div className="card-side" aria-hidden>
          {/* Третий слой: тот же размер 3:4, что 1–2; наискосок задаётся transform на .card-side */}
          <div className="card-side-inner">
            {/* Рамка 3:4; ultra — cover */}
            <div className="card-side-surface aspect-[3/4] w-full max-w-full overflow-hidden rounded-2xl ring-2 ring-white/18">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ultraBgUrl}
                alt=""
                className="card-side-img"
                draggable={false}
                decoding="async"
                loading={catalogStack ? "lazy" : "eager"}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="card-container absolute inset-0 z-[2] rounded-2xl">
        <div
          ref={tiltZoneRef}
          className={`absolute inset-0 z-30 ${
            heroStack ? "touch-manipulation" : "touch-none"
          } ${interactiveTilt ? "" : "pointer-events-none"}`}
          onPointerEnter={interactiveTilt ? onPointerEnter : undefined}
          onPointerDown={interactiveTilt ? onPointerDown : undefined}
          onPointerMove={interactiveTilt ? onPointerMove : undefined}
          onPointerUp={interactiveTilt ? onPointerUp : undefined}
          onPointerCancel={interactiveTilt ? onPointerUp : undefined}
          onPointerLeave={interactiveTilt ? onPointerLeave : undefined}
        >
          <div className="h-full w-full [perspective:min(900px,140vw)] [transform-style:preserve-3d] motion-reduce:[perspective:none]">
            <div
              ref={tiltRef}
              className="relative h-full w-full origin-center [will-change:transform] [transform-style:preserve-3d] motion-reduce:transform-none"
              style={{
                transform: `rotateX(0deg) rotateY(0deg) translateZ(${idleTranslateZ}px)`,
              }}
            >
              <div className="relative h-full w-full [transform-style:preserve-3d]">
                <div className="card-face-lenticular-thick relative isolate h-full w-full overflow-hidden rounded-2xl bg-black">
                  {hasVario ? (
                    <>
                      <div
                        ref={cardBackRef}
                        className={`card-back card-vario-back absolute inset-0 overflow-hidden rounded-2xl bg-black ${
                          heroStack
                            ? "transition-none"
                            : "transition-opacity duration-100 ease-linear"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={back}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          style={backPosStyle}
                          draggable={false}
                          decoding="async"
                          loading={catalogStack ? "lazy" : "eager"}
                        />
                      </div>
                      <div
                        ref={cardFrontRef}
                        className={`card-main card-vario-front relative overflow-hidden rounded-2xl ${
                          heroStack
                            ? "transition-none"
                            : "transition-opacity duration-100 ease-linear"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={front}
                          alt={card.title}
                          className="absolute inset-0 h-full w-full object-cover"
                          style={frontPosStyle}
                          draggable={false}
                          decoding="async"
                          loading={catalogStack ? "lazy" : "eager"}
                        />
                      </div>
                      <div
                        className="card-thickness-facets pointer-events-none absolute inset-0 z-[21] rounded-2xl"
                        aria-hidden
                      />
                      <div
                        ref={lenticularRef}
                        className="card-lenticular-overlay pointer-events-none absolute inset-0 z-[22] rounded-2xl motion-reduce:opacity-40"
                        aria-hidden
                      />
                    </>
                  ) : (
                    <>
                      <div className="card-main relative isolate overflow-hidden rounded-2xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={front}
                          alt={card.title}
                          className="absolute inset-0 h-full w-full object-cover"
                          style={frontPosStyle}
                          draggable={false}
                          decoding="async"
                          loading={catalogStack ? "lazy" : "eager"}
                        />
                      </div>
                      <div
                        className="card-thickness-facets pointer-events-none absolute inset-0 z-[21] rounded-2xl"
                        aria-hidden
                      />
                    </>
                  )}

                  <div
                    className="card-glare pointer-events-none absolute inset-0 rounded-2xl opacity-[0.18] mix-blend-overlay motion-reduce:opacity-[0.1]"
                    style={{
                      backgroundImage: HALFTONE_BG,
                      backgroundSize: "7px 7px",
                    }}
                    aria-hidden
                  />
                  <div
                    className={`card-glare hero-holo-iridescent pointer-events-none absolute inset-0 rounded-2xl mix-blend-overlay motion-reduce:opacity-[0.08] ${
                      catalogStack ? "opacity-[0.11]" : "opacity-[0.14]"
                    }`}
                    aria-hidden
                  />
                  <div
                    ref={holoGlareRef}
                    className="card-glare card-holo-tilt-gradient pointer-events-none absolute inset-0 rounded-2xl mix-blend-soft-light motion-reduce:opacity-0"
                    style={{
                      opacity: 0,
                      transition: "none",
                    }}
                    aria-hidden
                  />
                  <div
                    className="card-glare pointer-events-none absolute inset-0 rounded-2xl opacity-[0.09] mix-blend-overlay motion-reduce:opacity-[0.05]"
                    style={{
                      backgroundImage: HOLO_GRAIN,
                      backgroundSize: "88px 88px",
                    }}
                    aria-hidden
                  />
                  <div
                    className="card-glare pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_40px_rgba(0,0,0,0.14)]"
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {overlay ? (
        <div className="pointer-events-none absolute inset-0 z-[50]">{overlay}</div>
      ) : null}
    </div>
  );
}
