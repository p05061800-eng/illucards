"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { StoredCard } from "@/app/api/cards/route";
import {
  isFixedCardArtFramePreset,
  resolveCardArtBoxAspectCss,
} from "@/app/lib/cardAspectRatio";
import {
  cardArtFaceFitStyle,
  cardArtFaceObjectFitClass,
  cardArtFixedFrameImgClass,
  cardArtFixedFrameShellClass,
  categoryFocusContainStyle,
  categoryFocusCoverStyle,
} from "@/app/lib/imageFocus";
import { useCoarsePointerOrHoverNone } from "@/app/lib/useCoarsePointerOrHoverNone";
import { useIntrinsicImageAspect } from "@/app/lib/useIntrinsicImageAspect";
import { AdultContentBlurGate } from "@/app/components/AdultContentBlurGate";
import { cardRequiresAgeConfirmation } from "@/app/lib/cardRequiresAgeConfirmation";
import { FrontHoverMotionOverlay } from "@/app/components/FrontHoverMotionOverlay";
import { effectiveHoverMotionUrl } from "@/app/lib/frontHoverMotionUrl";
import {
  FirstVisitCardTiltHint,
  useFirstVisitCardTiltHint,
} from "./FirstVisitCardTiltHint";

const HOLO_GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.45'/%3E%3C/svg%3E\")";

const HALFTONE_BG = `radial-gradient(circle, rgba(255,255,255,0.14) 0.7px, transparent 1.1px)`;

export type CardStackVisualProps = {
  card: StoredCard;
  ultraBgUrl: string;
  /** Корневой блок (рамка по `frontImageWidth`/`Height` или по файлу лица) */
  rootClassName?: string;
  /** Усиленный выступ 3-го слоя слева/снизу — только для сетки каталога */
  catalogStack?: boolean;
  /** Герой: класс `hero-card-stack-visual` (без translate — центр задаётся вёрсткой героя) */
  heroStack?: boolean;
  /** Слой 3 (ultra): та же ось наклона, что в сетке каталога, а не геройская у правого верха */
  catalogLikeDiagonal?: boolean;
  /**
   * Сдвиг всей стопки как у героя (`hero-card-stack-visual`); третий слой — общий `.card-side`.
   * Без подсказки наклона и без геройской тач-логики — для страницы товара.
   */
  heroDiagonalLayout?: boolean;
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
  rootClassName,
  catalogStack = false,
  heroStack = false,
  catalogLikeDiagonal = false,
  heroDiagonalLayout = false,
  hideUltraLayer = false,
  overlay,
  dataCartFlySource,
}: CardStackVisualProps) {
  const resolvedRoot =
    rootClassName ??
    "relative mx-auto max-w-full overflow-visible rounded-2xl";

  const tiltZoneRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const holoGlareRef = useRef<HTMLDivElement>(null);
  const cardBackRef = useRef<HTMLDivElement>(null);
  const cardMiddleRef = useRef<HTMLDivElement>(null);
  const cardFrontRef = useRef<HTMLDivElement>(null);
  const cardBackImgRef = useRef<HTMLImageElement>(null);
  const cardFrontImgRef = useRef<HTMLImageElement>(null);
  const lenticularRef = useRef<HTMLDivElement>(null);
  const ultraSurfaceRef = useRef<HTMLDivElement>(null);
  const hoverMotionVideoRef = useRef<HTMLVideoElement | null>(null);
  const smoothedPxRef = useRef(0);
  const rafRef = useRef(0);
  const pendingRef = useRef<{ cx: number; cy: number } | null>(null);
  const reduceMotionRef = useRef(false);
  /** На главной с тачем: не тянуть 3D-наклон — только vario (меньше лагов) */
  const coarseTouchHeroRef = useRef(false);
  const coarsePointerOrHoverNone = useCoarsePointerOrHoverNone();

  /** Две разные картинки → варио в каталоге и герое (не только при effect===vario в JSON). */
  const hasVario = useMemo(() => {
    const f = card.frontImage?.trim() ?? "";
    const b = card.backImage?.trim() ?? "";
    return Boolean(f && b && b !== f);
  }, [card.frontImage, card.backImage]);

  /** Ultra + лицо/оборот (+ опционально середина): плавный кроссфейд по X. */
  const smoothBlendUltra = useMemo(
    () =>
      Boolean(card.varioSmoothBlend) &&
      !hideUltraLayer &&
      hasVario &&
      card.effect !== "morphing",
    [card.varioSmoothBlend, hideUltraLayer, hasVario, card.effect]
  );

  /** Две картинки (мелкий герой → крупный), кроссфейд + масштаб по X. Без средней стороны. */
  const morphActive = useMemo(
    () =>
      card.effect === "morphing" &&
      hasVario &&
      !card.middleImage?.trim(),
    [card.effect, card.middleImage, hasVario]
  );

  const hasMiddle = useMemo(
    () => Boolean(card.middleImage?.trim()),
    [card.middleImage]
  );

  const rafDrivenVario = Boolean(
    heroStack || smoothBlendUltra || hasMiddle || morphActive
  );

  const varioSmoothing = useMemo(() => {
    const s = card.varioSmoothing;
    const n = typeof s === "number" && Number.isFinite(s) ? s : 0.18;
    return Math.min(0.6, Math.max(0.05, n));
  }, [card.varioSmoothing]);

  const frontSrc = card.frontImage?.trim() ?? "";

  const fixedCatalogFrame = isFixedCardArtFramePreset(card.cardArtFramePreset);
  /**
   * Каталог и страница товара: при «по файлу» — та же рамка по аспекту, картинка целиком
   * (`contain` + фокус). Герой без этих флагов — прежняя отрисовка. Жёсткий пресет — contain.
   */
  const productFaceCoversFrame =
    (heroDiagonalLayout || catalogStack) && !fixedCatalogFrame;
  /** Всегда подмешиваем интринсик лица в resolve — спейсер ниже только по `stackBoxAspectCss`. */
  const { aspectRatioCss: spacerIntrinsicCss } = useIntrinsicImageAspect(
    frontSrc || undefined,
  );
  const stackBoxAspectCss = resolveCardArtBoxAspectCss(
    card,
    spacerIntrinsicCss,
    null,
  );

  /** Каталог: умеренный наклон; герой и страница товара — как на главном герое (17°). */
  const maxTilt = catalogStack ? 10 : 17;
  const idleTranslateZ = catalogStack ? 4 : 8;

  /** Vario и наклон — везде одна логика глубины (см. `applyTilt`). */
  const interactiveTilt = true;

  const { visible: tiltHintVisible, dismiss: dismissTiltHint } =
    useFirstVisitCardTiltHint(Boolean(heroStack));

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

    // Vario: переключение по X — работает и при «уменьшить движение», и на таче
    if (hasVario) {
      const mouseX = Math.min(1, Math.max(0, px));
      smoothedPxRef.current +=
        (mouseX - smoothedPxRef.current) * varioSmoothing;
      const mx = Math.min(1, Math.max(0, smoothedPxRef.current));
      const back = cardBackRef.current;
      const mid = cardMiddleRef.current;
      const front = cardFrontRef.current;
      const ultra = ultraSurfaceRef.current;
      if (morphActive) {
        const t = mx;
        const rm = reduceMotionRef.current;
        const sMin = 0.56;
        const sMax = 1;
        const fScale = rm ? 1 : sMin + (sMax - sMin) * (1 - t);
        const bScale = rm ? 1 : sMin + (sMax - sMin) * t;
        if (ultra) ultra.style.opacity = "1";
        if (back) back.style.opacity = String(t);
        if (front) front.style.opacity = String(1 - t);
        const fi = cardFrontImgRef.current;
        const bi = cardBackImgRef.current;
        if (fi) {
          fi.style.transform = `scale(${fScale})`;
          fi.style.transformOrigin = "center center";
        }
        if (bi) {
          bi.style.transform = `scale(${bScale})`;
          bi.style.transformOrigin = "center center";
        }
      } else if (smoothBlendUltra && ultra && hasMiddle && mid) {
        const t = mx;
        /* Полный набор кубических весов Бернштайна (сумма = 1); иначе при t=0 все три слоя 0 → чёрный экран */
        const w0 = (1 - t) ** 3;
        const w1 = 3 * (1 - t) ** 2 * t;
        const w2 = 3 * (1 - t) * t ** 2;
        const w3 = t ** 3;
        /* Третий слой (ultra) всегда непрозрачен — иначе наискосок пропадает в покое при mx→1 */
        ultra.style.opacity = "1";
        if (back) back.style.opacity = String(w0);
        mid.style.opacity = String(w1 + w2);
        if (front) front.style.opacity = String(w3);
      } else if (smoothBlendUltra && !hasMiddle) {
        let b = 2 * mx * (1 - mx);
        let f = mx * mx;
        /* При mx≈0 оба веса 0 — поверх ultra (z ниже) не виден, остаётся чёрный фон .card-face */
        if (b + f < 1e-3) {
          f = 1;
          b = 0;
        }
        if (ultra) ultra.style.opacity = "1";
        if (back) back.style.opacity = String(b);
        if (front) front.style.opacity = String(f);
      } else if (hasMiddle && mid) {
        if (ultra) ultra.style.opacity = "1";
        let wF = Math.max(0, Math.min(1, 1 - 2 * mx));
        let wM = Math.max(0, 1 - 2 * Math.abs(mx - 0.5));
        let wB = Math.max(0, Math.min(1, 2 * mx - 1));
        const sum = wF + wM + wB || 1;
        wF /= sum;
        wM /= sum;
        wB /= sum;
        if (front) front.style.opacity = String(wF);
        mid.style.opacity = String(wM);
        if (back) back.style.opacity = String(wB);
      } else {
        if (ultra) ultra.style.opacity = "1";
        if (back) back.style.opacity = String(mx);
        if (front) front.style.opacity = String(1 - mx);
      }
      const lent = lenticularRef.current;
      const liteLenticular =
        heroStack && coarseTouchHeroRef.current ? false : true;
      /* В сетке каталога много карточек — не трогаем lenticular (лишние стили на каждом move) */
      if (
        lent &&
        !reduceMotionRef.current &&
        liteLenticular &&
        !catalogStack
      ) {
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
        const zLift =
          heroStack && coarseTouchHeroRef.current ? idleTranslateZ + 6 : idleTranslateZ;
        tilt.style.transform = `rotateX(0deg) rotateY(0deg) translateZ(${zLift}px)`;
      }
      if (holoGlare && skip3dTilt) {
        /* На таче без 3D-наклона — лёгкий блик вместо полного отключения */
        holoGlare.style.opacity =
          heroStack && coarseTouchHeroRef.current ? "0.14" : "0";
      }
      return;
    }

    const ry = Math.max(-maxTilt, Math.min(maxTilt, nx * maxTilt));
    const rx = Math.max(-maxTilt, Math.min(maxTilt, -ny * maxTilt));

    const tiltMag =
      maxTilt > 0 ? Math.sqrt(rx * rx + ry * ry) / maxTilt : 0;
    const tiltZBoost = catalogStack ? 14 : 22;
    const z = idleTranslateZ + tiltMag * tiltZBoost;
    tilt.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(${z}px)`;

    if (holoGlare) {
      holoGlare.style.opacity = String(Math.min(0.65, 0.22 + tiltMag * 0.45));
      holoGlare.style.backgroundImage = `linear-gradient(118deg, transparent 28%, rgba(255,255,255,0.2) 50%, transparent 72%)`;
      holoGlare.style.backgroundSize = "220% 220%";
      holoGlare.style.backgroundPosition = `${20 + px * 55}% ${16 + py * 60}%`;
      holoGlare.style.mixBlendMode = "soft-light";
      holoGlare.style.transition = "none";
    }
  }, [
    hasVario,
    hasMiddle,
    smoothBlendUltra,
    varioSmoothing,
    maxTilt,
    idleTranslateZ,
    catalogStack,
    heroStack,
    morphActive,
  ]);

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      dismissTiltHint();
      /* iOS шлёт и pointer, и touch — движение обрабатывают touch listeners */
      if (heroStack && e.pointerType === "touch") return;
      pendingRef.current = { cx: e.clientX, cy: e.clientY };
      if (rafRef.current !== 0) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(applyTilt);
    },
    [applyTilt, dismissTiltHint, heroStack]
  );

  const onPointerEnter = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      void hoverMotionVideoRef.current?.play()?.catch(() => {});
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
    dismissTiltHint();
    void hoverMotionVideoRef.current?.play()?.catch(() => {});
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
  }, [applyTilt, dismissTiltHint, heroStack]);

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

    const idleTargetPx = smoothBlendUltra ? 1 : 0;
    smoothedPxRef.current = idleTargetPx;
    const back = cardBackRef.current;
    const mid = cardMiddleRef.current;
    const front = cardFrontRef.current;
    const ultra = ultraSurfaceRef.current;
    if (hasVario) {
      if (morphActive) {
        const t = idleTargetPx;
        const rm = reduceMotionRef.current;
        const sMin = 0.56;
        const sMax = 1;
        const fScale = rm ? 1 : sMin + (sMax - sMin) * (1 - t);
        const bScale = rm ? 1 : sMin + (sMax - sMin) * t;
        if (ultra) ultra.style.opacity = "1";
        if (back) back.style.opacity = String(t);
        if (front) front.style.opacity = String(1 - t);
        const fi = cardFrontImgRef.current;
        const bi = cardBackImgRef.current;
        if (fi) {
          fi.style.transform = `scale(${fScale})`;
          fi.style.transformOrigin = "center center";
        }
        if (bi) {
          bi.style.transform = `scale(${bScale})`;
          bi.style.transformOrigin = "center center";
        }
      } else if (smoothBlendUltra && ultra && hasMiddle && mid) {
        const t = idleTargetPx;
        const w0 = (1 - t) ** 3;
        const w1 = 3 * (1 - t) ** 2 * t;
        const w2 = 3 * (1 - t) * t ** 2;
        const w3 = t ** 3;
        ultra.style.opacity = "1";
        if (back) back.style.opacity = String(w0);
        mid.style.opacity = String(w1 + w2);
        if (front) front.style.opacity = String(w3);
      } else if (smoothBlendUltra && !hasMiddle) {
        const mx = idleTargetPx;
        let b = 2 * mx * (1 - mx);
        let f = mx * mx;
        if (b + f < 1e-3) {
          f = 1;
          b = 0;
        }
        if (ultra) ultra.style.opacity = "1";
        if (back) back.style.opacity = String(b);
        if (front) front.style.opacity = String(f);
      } else if (hasMiddle && mid) {
        if (ultra) ultra.style.opacity = "1";
        const mx = 0;
        let wF = Math.max(0, Math.min(1, 1 - 2 * mx));
        let wM = Math.max(0, 1 - 2 * Math.abs(mx - 0.5));
        let wB = Math.max(0, Math.min(1, 2 * mx - 1));
        const sum = wF + wM + wB || 1;
        wF /= sum;
        wM /= sum;
        wB /= sum;
        if (front) front.style.opacity = String(wF);
        mid.style.opacity = String(wM);
        if (back) back.style.opacity = String(wB);
      } else {
        if (ultra) ultra.style.opacity = "1";
        if (back) back.style.opacity = String(idleTargetPx);
        if (front) front.style.opacity = String(1 - idleTargetPx);
      }
      if (!morphActive) {
        const fi = cardFrontImgRef.current;
        const bi = cardBackImgRef.current;
        if (fi) fi.style.transform = "";
        if (bi) bi.style.transform = "";
      }
    }
    if (lenticularRef.current) {
      lenticularRef.current.style.setProperty("--lenticular-x", "0.5");
      lenticularRef.current.style.setProperty("--lenticular-y", "0.5");
    }
    const hv = hoverMotionVideoRef.current;
    if (hv) {
      hv.pause();
      hv.currentTime = 0;
    }
  }, [idleTranslateZ, hasVario, hasMiddle, smoothBlendUltra, morphActive]);

  const onPointerLeave = useCallback(() => {
    resetInteractiveState();
  }, [resetInteractiveState]);

  useLayoutEffect(() => {
    resetInteractiveState();
  }, [card.id, smoothBlendUltra, hasMiddle, morphActive, resetInteractiveState]);

  /**
   * Vario на телефоне: без pointer capture в герое `pointermove` в WebKit часто не идёт
   * во время жеста. Нативные touch-события дают координаты; passive — не блокируем клик по Link.
   */
  useEffect(() => {
    if (!hasVario) return;
    const el = tiltZoneRef.current;
    if (!el) return;

    const syncFromTouch = (e: TouchEvent) => {
      dismissTiltHint();
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
  }, [hasVario, applyTilt, card.id, dismissTiltHint]);

  /** Тач / без hover — подстраховка `play()` после монтирования (вместе с `autoPlay` на `<video>`). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const hm = effectiveHoverMotionUrl(card.frontHoverGif);
    if (!hm) return;
    if (!coarsePointerOrHoverNone) return;
    const id = requestAnimationFrame(() => {
      void hoverMotionVideoRef.current?.play()?.catch(() => {});
    });
    return () => cancelAnimationFrame(id);
  }, [card.frontHoverGif, card.id, coarsePointerOrHoverNone]);

  const faceCls = cardArtFaceObjectFitClass(card.cardArtFramePreset);
  const fixedShell = cardArtFixedFrameShellClass(fixedCatalogFrame);
  const fixedImg = cardArtFixedFrameImgClass(fixedCatalogFrame);

  /** Герой и каталог: без lazy на лице/обороте/ultra — иначе чёрный фон до decode. */
  const eagerFaceImages = catalogStack || heroStack;

  /** Третий слой: при источнике из «Фон категории» — тот же кадр, что в админке. */
  const ultraLayerImgStyle: CSSProperties = useMemo(() => {
    if (productFaceCoversFrame) {
      const cat = card.categoryBg?.trim();
      if (cat && ultraBgUrl === cat) {
        return categoryFocusCoverStyle(card.categoryBgFocus);
      }
      return categoryFocusCoverStyle(card.frontImageFocus);
    }
    const cat = card.categoryBg?.trim();
    if (cat && ultraBgUrl === cat) {
      return categoryFocusContainStyle(card.categoryBgFocus);
    }
    if (fixedCatalogFrame) {
      return cardArtFaceFitStyle(card.cardArtFramePreset, null);
    }
    return categoryFocusContainStyle(null);
  }, [
    productFaceCoversFrame,
    fixedCatalogFrame,
    ultraBgUrl,
    card.categoryBg,
    card.categoryBgFocus,
    card.cardArtFramePreset,
    card.frontImageFocus,
  ]);

  if (!frontSrc) return null;

  const front = frontSrc;
  const hoverMotion = effectiveHoverMotionUrl(card.frontHoverGif);

  const back = card.backImage?.trim() ?? "";
  const middle = card.middleImage?.trim() ?? "";
  const frontPosStyle: CSSProperties = productFaceCoversFrame
    ? categoryFocusCoverStyle(card.frontImageFocus)
    : cardArtFaceFitStyle(card.cardArtFramePreset, card.frontImageFocus);
  const backPosStyle: CSSProperties = productFaceCoversFrame
    ? categoryFocusCoverStyle(card.backImageFocus)
    : cardArtFaceFitStyle(card.cardArtFramePreset, card.backImageFocus);
  const middlePosStyle: CSSProperties = productFaceCoversFrame
    ? categoryFocusCoverStyle(card.middleImageFocus)
    : cardArtFaceFitStyle(card.cardArtFramePreset, card.middleImageFocus);

  /** Боковые слои vario: заполняют родителя. Лицо: `relative` — якорь для hover-оверлея. */
  const faceSideInnerShellClass = productFaceCoversFrame
    ? "absolute inset-0 flex h-full min-h-0 w-full min-w-0 overflow-hidden rounded-2xl"
    : fixedShell;
  const faceFrontInnerShellClass = productFaceCoversFrame
    ? "relative flex h-full min-h-0 w-full min-w-0 overflow-hidden rounded-2xl"
    : fixedShell;
  const faceImgClass = productFaceCoversFrame
    ? `block h-full min-h-0 w-full min-w-0 max-h-full max-w-full rounded-2xl object-cover ${faceCls}`.trim()
    : `${fixedImg} rounded-2xl ${faceCls}`;

  /** Согласовано с лицом: hover в каталоге/товаре — cover в той же рамке, что лицо. */
  const catalogOrProductHoverFillsFace =
    ((catalogStack || heroDiagonalLayout) && !fixedCatalogFrame) &&
    Boolean(hoverMotion);
  const hoverMotionMediaStyle = catalogOrProductHoverFillsFace
    ? categoryFocusCoverStyle(card.frontImageFocus)
    : frontPosStyle;

  const hoverMotionLayerClass = coarsePointerOrHoverNone
    ? "pointer-events-none absolute inset-0 z-[4] flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-2xl bg-black opacity-100 transition-opacity duration-200 motion-reduce:opacity-0"
    : [
        "pointer-events-none absolute inset-0 z-[4] flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-2xl bg-black",
        "opacity-100 transition-opacity duration-200 motion-reduce:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover/cardstack-hover:opacity-100",
      ].join(" ");

  return (
    <div
      className={[
        "illucards-card group/cardstack-hover card-stack-visual-art min-w-0 max-w-full",
        resolvedRoot,
        catalogStack ? "catalog-card-stack overflow-visible" : "",
        heroStack || heroDiagonalLayout ? "hero-card-stack-visual" : "",
        heroStack && catalogLikeDiagonal ? "hero-stack-catalog-diagonal" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...(dataCartFlySource ? { "data-cart-fly-source": true } : {})}
    >
      <AdultContentBlurGate
        isAdult={cardRequiresAgeConfirmation(card)}
        cardId={card.id}
      >
      <div className="relative block w-full max-w-full min-h-0 min-w-0">
        {frontSrc ? (
          <div
            aria-hidden
            className="block w-full max-w-full rounded-2xl opacity-0 pointer-events-none select-none"
            style={{ aspectRatio: stackBoxAspectCss }}
          />
        ) : null}

        {!hideUltraLayer ? (
          <div className="card-side" aria-hidden>
            {/* Третий слой: тот же кадр, что 1–2; наискосок задаётся transform на .card-side */}
            <div className="card-side-inner">
              {/* ultra — целиком (contain) */}
                <div
                ref={ultraSurfaceRef}
                className={[
                  "card-side-surface flex h-full min-h-0 min-w-0 w-full max-w-full items-stretch justify-stretch overflow-hidden rounded-2xl bg-black ring-2 ring-white/18",
                ].join(" ")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ultraBgUrl}
                  alt=""
                  className={`card-side-img rounded-2xl ${faceCls} ${
                    productFaceCoversFrame || !fixedCatalogFrame
                      ? "h-full min-h-0 w-full min-w-0 max-h-full max-w-full object-cover"
                      : fixedImg
                  }`.trim()}
                  style={
                    productFaceCoversFrame || !fixedCatalogFrame
                      ? {
                          ...ultraLayerImgStyle,
                          height: "100%",
                          width: "100%",
                          maxHeight: "100%",
                        }
                      : ultraLayerImgStyle
                  }
                  draggable={false}
                  decoding="async"
                  loading={eagerFaceImages ? "eager" : "lazy"}
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="card-container absolute inset-0 z-[2] rounded-2xl">
        <div
          ref={tiltZoneRef}
          className={`${
            interactiveTilt ? "card-stack-tilt-zone " : ""
          }absolute inset-0 z-30 ${
            heroStack ? "touch-manipulation" : "touch-none"
          } ${interactiveTilt ? "" : "pointer-events-none"}`}
          onPointerEnter={interactiveTilt ? onPointerEnter : undefined}
          onPointerDown={interactiveTilt ? onPointerDown : undefined}
          onPointerMove={interactiveTilt ? onPointerMove : undefined}
          onPointerUp={interactiveTilt ? onPointerUp : undefined}
          onPointerCancel={interactiveTilt ? onPointerUp : undefined}
          onPointerLeave={interactiveTilt ? onPointerLeave : undefined}
        >
          <div
            className={`absolute inset-0 [transform-style:preserve-3d] motion-reduce:[perspective:none] ${
              heroStack
                ? "[perspective:min(900px,95vw)]"
                : "[perspective:min(900px,140vw)]"
            }`}
          >
            <div
              ref={tiltRef}
              className={`absolute inset-0 [will-change:transform] [transform-style:preserve-3d] motion-reduce:transform-none ${
                heroStack ? "origin-top-right" : "origin-center"
              }`}
              style={{
                transform: `rotateX(0deg) rotateY(0deg) translateZ(${idleTranslateZ}px)`,
              }}
            >
              <div className="absolute inset-0 [transform-style:preserve-3d]">
                <div className="card-face-lenticular-thick absolute inset-0 isolate overflow-visible rounded-2xl bg-black">
                  {hasVario ? (
                    <>
                      <div
                        ref={cardBackRef}
                        className={`card-back card-vario-back absolute inset-0 z-[1] rounded-2xl bg-black ${
                          productFaceCoversFrame
                            ? "overflow-hidden"
                            : "overflow-visible"
                        } ${
                          rafDrivenVario
                            ? "transition-none"
                            : "transition-opacity duration-100 ease-linear"
                        }`}
                      >
                        <div
                          className={
                            productFaceCoversFrame
                              ? faceSideInnerShellClass
                              : fixedShell
                          }
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            ref={cardBackImgRef}
                            src={back}
                            alt=""
                            className={faceImgClass}
                            style={
                              productFaceCoversFrame
                                ? {
                                    ...backPosStyle,
                                    height: "100%",
                                    width: "100%",
                                    maxHeight: "100%",
                                  }
                                : backPosStyle
                            }
                            draggable={false}
                            decoding="async"
                            loading={eagerFaceImages ? "eager" : "lazy"}
                          />
                        </div>
                      </div>
                      {middle ? (
                        <div
                          ref={cardMiddleRef}
                          className={`card-vario-middle absolute inset-0 z-[2] rounded-2xl bg-black ${
                            productFaceCoversFrame
                              ? "overflow-hidden"
                              : "overflow-visible"
                          } ${
                            rafDrivenVario
                              ? "transition-none"
                              : "transition-opacity duration-100 ease-linear"
                          }`}
                        >
                          <div
                            className={
                              productFaceCoversFrame
                                ? faceSideInnerShellClass
                                : fixedShell
                            }
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={middle}
                              alt=""
                              className={faceImgClass}
                              style={
                                productFaceCoversFrame
                                  ? {
                                      ...middlePosStyle,
                                      height: "100%",
                                      width: "100%",
                                      maxHeight: "100%",
                                    }
                                  : middlePosStyle
                              }
                              draggable={false}
                              decoding="async"
                              loading={eagerFaceImages ? "eager" : "lazy"}
                            />
                          </div>
                        </div>
                      ) : null}
                      <div
                        ref={cardFrontRef}
                        className={`card-main card-vario-front absolute inset-0 z-[3] rounded-2xl ${
                          productFaceCoversFrame
                            ? "overflow-hidden"
                            : "overflow-visible"
                        } ${
                          rafDrivenVario
                            ? "transition-none"
                            : "transition-opacity duration-100 ease-linear"
                        }`}
                      >
                        <div
                          className={
                            productFaceCoversFrame
                              ? faceFrontInnerShellClass
                              : `relative ${fixedShell}`
                          }
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            ref={morphActive ? cardFrontImgRef : undefined}
                            src={front}
                            alt={card.title}
                            className={faceImgClass}
                            style={
                              productFaceCoversFrame
                                ? {
                                    ...frontPosStyle,
                                    height: "100%",
                                    width: "100%",
                                    maxHeight: "100%",
                                  }
                                : frontPosStyle
                            }
                            draggable={false}
                            decoding="async"
                            loading={eagerFaceImages ? "eager" : "lazy"}
                          />
                          {hoverMotion ? (
                            <FrontHoverMotionOverlay
                              url={hoverMotion}
                              videoRef={hoverMotionVideoRef}
                              className={hoverMotionLayerClass}
                              style={hoverMotionMediaStyle}
                              fillFaceFrame={catalogOrProductHoverFillsFace}
                              autoPlay={coarsePointerOrHoverNone}
                            />
                          ) : null}
                        </div>
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
                      <div
                        className={`card-main absolute inset-0 isolate rounded-2xl ${
                          productFaceCoversFrame
                            ? "flex h-full min-h-0 w-full min-w-0 overflow-hidden"
                            : `${fixedShell} overflow-visible`
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={front}
                          alt={card.title}
                          className={faceImgClass}
                          style={
                            productFaceCoversFrame
                              ? {
                                  ...frontPosStyle,
                                  height: "100%",
                                  width: "100%",
                                  maxHeight: "100%",
                                }
                              : frontPosStyle
                          }
                          draggable={false}
                          decoding="async"
                          loading={eagerFaceImages ? "eager" : "lazy"}
                        />
                        {hoverMotion ? (
                          <FrontHoverMotionOverlay
                            url={hoverMotion}
                            videoRef={hoverMotionVideoRef}
                            className={hoverMotionLayerClass}
                            style={hoverMotionMediaStyle}
                            fillFaceFrame={catalogOrProductHoverFillsFace}
                            autoPlay={coarsePointerOrHoverNone}
                          />
                        ) : null}
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
      </div>
      </AdultContentBlurGate>

      {heroStack ? (
        <FirstVisitCardTiltHint visible={tiltHintVisible} hasVario={hasVario} />
      ) : null}

      {overlay ? (
        <div className="pointer-events-none absolute inset-0 z-[50]">{overlay}</div>
      ) : null}
    </div>
  );
}
