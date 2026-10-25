"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { StoredCard } from "@/app/api/cards/route";
import { apiUrl } from "@/app/lib/apiUrl";
import { resolveCustomOrderHeroCards } from "@/app/lib/customOrderHeroCarousel";
import { ultraOrHeroBgUrl } from "@/app/lib/cardUltraBg";
import {
  customOrderForHero,
  parsePromoHomeConfig,
  promoCarouselForHero,
  type PromoHomeConfig,
  type PromoSlide,
} from "@/app/lib/promoSlidesJson";
import { ProductCardNavArrowIcon } from "@/app/components/card-showcase/CardViewer";
import { CardStackVisual } from "@/components/hero/CardStackVisual";

/** Как в «Новинках»: горизонтальный жест переключает слайд. */
const CUSTOM_ORDER_SWIPE_MIN_PX = 48;

type Props = {
  cards?: StoredCard[];
  initialSlides?: PromoSlide[];
  initialConfig?: PromoHomeConfig;
};

function configFromProps(
  initialConfig?: PromoHomeConfig,
  initialSlides?: PromoSlide[],
): PromoHomeConfig {
  if (initialConfig) return parsePromoHomeConfig(initialConfig);
  if (initialSlides && initialSlides.length > 0) {
    return parsePromoHomeConfig({ items: initialSlides });
  }
  return { customOrder: { imageUrl: "", href: "" }, items: [] };
}

export default function PromoSlider({
  cards = [],
  initialSlides = [],
  initialConfig,
}: Props) {
  const [config, setConfig] = useState<PromoHomeConfig>(() =>
    configFromProps(initialConfig, initialSlides),
  );
  const [catalogCards, setCatalogCards] = useState<StoredCard[]>(cards);

  const promoSnap = useMemo(
    () => JSON.stringify({ initialConfig, initialSlides }),
    [initialConfig, initialSlides],
  );

  useEffect(() => {
    try {
      const parsed = JSON.parse(promoSnap) as {
        initialConfig?: PromoHomeConfig;
        initialSlides?: PromoSlide[];
      };
      setConfig(configFromProps(parsed.initialConfig, parsed.initialSlides));
    } catch {
      /* ignore */
    }
  }, [promoSnap]);

  useEffect(() => {
    setCatalogCards(cards);
  }, [cards]);

  useEffect(() => {
    if (cards.length > 0) return;
    let cancelled = false;
    fetch(apiUrl("/api/cards"))
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: unknown) => {
        if (cancelled || !Array.isArray(data)) return;
        setCatalogCards(data as StoredCard[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cards.length]);

  useEffect(() => {
    const hasInitialArt =
      configFromProps(initialConfig, initialSlides).customOrder.imageUrl.trim()
        .length > 0 ||
      configFromProps(initialConfig, initialSlides).items.some(
        (s) => s.imageUrl.trim().length > 0,
      );
    if (hasInitialArt) return;
    let cancelled = false;
    fetch(apiUrl("/api/promo-slides"))
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: unknown) => {
        if (cancelled) return;
        const next = parsePromoHomeConfig(data);
        setConfig((prev) => {
          const hasArt =
            next.customOrder.imageUrl.trim().length > 0 ||
            next.items.some((s) => s.imageUrl.trim().length > 0);
          if (hasArt) return next;
          if (
            prev.customOrder.imageUrl.trim().length > 0 ||
            prev.items.length > 0
          ) {
            return prev;
          }
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialConfig, initialSlides]);

  const orderTile = customOrderForHero(config.customOrder);
  const orderCards = resolveCustomOrderHeroCards(
    catalogCards,
    orderTile?.imageUrl,
  );
  const showOrderCol = orderCards.length > 0 || orderTile != null;
  const promos = promoCarouselForHero(config.items);
  const colCount = (showOrderCol ? 1 : 0) + (promos.length > 0 ? 1 : 0);
  if (colCount === 0) return null;

  const pairClass =
    colCount === 1
      ? "hero-promo-pair hero-promo-pair--single"
      : "hero-promo-pair";

  return (
    <div className="hero-promo-slider w-full min-w-0">
      <div className={pairClass}>
        <div className="hero-promo-pair-grid">
          {showOrderCol ? (
            <PromoColumn title="Карточка на заказ">
              <CustomOrderCarousel
                cards={orderCards}
                fallbackImageUrl={orderTile?.imageUrl ?? ""}
                examplesHref={config.customOrder.href.trim()}
              />
            </PromoColumn>
          ) : null}
          {promos.length > 0 ? (
            <PromoColumn title="Акции">
              <PromoCarousel slides={promos} />
            </PromoColumn>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PromoColumn({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="hero-promo-col">
      <h2 className="hero-promo-col-title">
        <span className="hero-promo-col-title-text">{title}</span>
      </h2>
      {children}
    </div>
  );
}

function isHttpHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function promoInternalPath(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    const hashParts = trimmed.split("#");
    if (hashParts.length > 2) {
      return `${hashParts[0]}#${hashParts[1]}`;
    }
    return trimmed;
  }
  try {
    const url = new URL(trimmed, "https://www.illucards.by");
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "illucards.by") return null;
    const hash = url.hash.includes("#", 1)
      ? `#${url.hash.slice(1).split("#")[0]}`
      : url.hash;
    return `${url.pathname}${url.search}${hash}` || "/";
  } catch {
    return null;
  }
}

function PromoLinkedMedia({
  src,
  href,
  eager,
  label,
}: {
  src: string;
  href: string;
  eager?: boolean;
  label: string;
}) {
  const [loadFailed, setLoadFailed] = useState(false);
  const image =
    loadFailed || !src ? (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-zinc-900 px-3 text-center">
        <span className="text-xs font-medium text-zinc-400">{label}</span>
        <span className="text-[11px] leading-snug text-zinc-600">
          Не удалось загрузить изображение.
        </span>
      </div>
    ) : (
      // eslint-disable-next-line @next/next/no-img-element -- баннеры из /uploads/
      <img
        src={src}
        alt=""
        className="hero-promo-tile-img"
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onError={() => setLoadFailed(true)}
      />
    );

  const trimmed = href.trim();
  if (!trimmed) {
    return image;
  }

  const linkClass =
    "hero-promo-tile-link hero-promo-tile-hit outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60";

  const internal = promoInternalPath(trimmed);
  if (internal) {
    return (
      <Link href={internal} className={linkClass} aria-label={label}>
        {image}
      </Link>
    );
  }

  if (isHttpHref(trimmed)) {
    return (
      <a
        href={trimmed}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        aria-label={label}
      >
        {image}
      </a>
    );
  }

  return (
    <Link href={trimmed} className={linkClass} aria-label={label}>
      {image}
    </Link>
  );
}

function PromoCtaStack({ examplesHref }: { examplesHref: string }) {
  return (
    <div className="hero-promo-cta-stack">
      {examplesHref ? (
        isHttpHref(examplesHref) ? (
          <a
            href={examplesHref}
            target="_blank"
            rel="noopener noreferrer"
            className="hero-promo-cta"
          >
            Примеры
          </a>
        ) : (
          <Link href={examplesHref} className="hero-promo-cta">
            Примеры
          </Link>
        )
      ) : null}
      <span
        className="hero-promo-cta hero-promo-cta--coming-soon"
        aria-disabled="true"
      >
        (в разработке)
      </span>
    </div>
  );
}

function CustomOrderCarousel({
  cards,
  fallbackImageUrl,
  examplesHref,
}: {
  cards: StoredCard[];
  fallbackImageUrl: string;
  examplesHref: string;
}) {
  const [index, setIndex] = useState(0);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const n = cards.length;
  const safeIndex = n === 0 ? 0 : ((index % n) + n) % n;
  const canCycle = n > 1;
  const activeCard = n > 0 ? cards[safeIndex] : null;

  useEffect(() => {
    if (index >= n && n > 0) setIndex(0);
  }, [index, n]);

  const step = useCallback(
    (delta: number) => {
      if (n < 2) return;
      setIndex((i) => (i + delta + n * 16) % n);
    },
    [n],
  );

  const onArrowKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (n < 2) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      }
    },
    [n, step],
  );

  const applySwipe = useCallback(
    (start: { x: number; y: number }, endX: number, endY: number) => {
      if (n < 2) return;
      const dx = endX - start.x;
      const dy = endY - start.y;
      if (
        Math.abs(dx) < CUSTOM_ORDER_SWIPE_MIN_PX ||
        Math.abs(dx) < Math.abs(dy)
      ) {
        return;
      }
      if (dx < 0) step(1);
      else step(-1);
    },
    [n, step],
  );

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType !== "touch") return;
      if (n < 2) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("a, button")) return;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    },
    [n],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const start = dragStartRef.current;
      dragStartRef.current = null;
      if (!start) return;
      applySwipe(start, e.clientX, e.clientY);
    },
    [applySwipe],
  );

  const onPointerCancel = useCallback(() => {
    dragStartRef.current = null;
  }, []);

  if (!activeCard && !fallbackImageUrl) return null;

  const artW =
    activeCard &&
    typeof activeCard.frontImageWidth === "number" &&
    activeCard.frontImageWidth > 0
      ? activeCard.frontImageWidth
      : 2;
  const artH =
    activeCard &&
    typeof activeCard.frontImageHeight === "number" &&
    activeCard.frontImageHeight > 0
      ? activeCard.frontImageHeight
      : 3;

  return (
    <div
      className="hero-custom-order-tile"
      style={{
        ["--hero-custom-order-w" as string]: String(artW),
        ["--hero-custom-order-h" as string]: String(artH),
      }}
      aria-roledescription="carousel"
      aria-label="Карточка на заказ"
    >
      <div
        className="hero-custom-order-stage"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {activeCard ? (
          <div key={activeCard.id} className="hero-custom-order-fill">
            <div className="hero-custom-order-frame">
              <div className="hero-custom-order-art">
                <div className="hero-custom-order-card-shell">
                  <CardStackVisual
                    card={activeCard}
                    ultraBgUrl={ultraOrHeroBgUrl(activeCard)}
                    catalogStack
                    hideUltraLayer
                    navigationTapSafe
                    rootClassName="relative h-full w-full max-w-none bg-transparent"
                  />
                  <button
                    type="button"
                    className="hero-custom-order-arrow hero-custom-order-arrow--prev"
                    aria-label="Предыдущая карточка на заказ"
                    disabled={n < 2}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      step(-1);
                    }}
                    onKeyDown={onArrowKeyDown}
                  >
                    <ProductCardNavArrowIcon direction="prev" />
                  </button>
                  <button
                    type="button"
                    className="hero-custom-order-arrow hero-custom-order-arrow--next"
                    aria-label="Следующая карточка на заказ"
                    disabled={n < 2}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      step(1);
                    }}
                    onKeyDown={onArrowKeyDown}
                  >
                    <ProductCardNavArrowIcon direction="next" />
                  </button>
                  <PromoCtaStack examplesHref={examplesHref} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="hero-custom-order-fill">
            <div className="hero-custom-order-frame">
              <div className="hero-custom-order-art">
                <div className="hero-custom-order-card-shell">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fallbackImageUrl}
                    alt=""
                    className="hero-custom-order-fallback-img"
                    draggable={false}
                  />
                  <button
                    type="button"
                    className="hero-custom-order-arrow hero-custom-order-arrow--prev"
                    aria-label="Предыдущая карточка на заказ"
                    disabled
                  >
                    <ProductCardNavArrowIcon direction="prev" />
                  </button>
                  <button
                    type="button"
                    className="hero-custom-order-arrow hero-custom-order-arrow--next"
                    aria-label="Следующая карточка на заказ"
                    disabled
                  >
                    <ProductCardNavArrowIcon direction="next" />
                  </button>
                  <PromoCtaStack examplesHref={examplesHref} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {canCycle ? (
        <p className="hero-custom-order-counter" aria-live="polite">
          {safeIndex + 1} из {n}
        </p>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {activeCard
          ? `${safeIndex + 1} из ${n}: ${activeCard.title}`
          : "Карточка на заказ"}
      </p>
    </div>
  );
}

function PromoCarousel({ slides }: { slides: PromoSlide[] }) {
  const [index, setIndex] = useState(0);
  const safeIndex = slides.length === 0 ? 0 : index % slides.length;

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [index, slides.length]);

  const next = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (slides.length < 2) return;
      setIndex((i) => (i + 1) % slides.length);
    },
    [slides.length],
  );

  const hasNext = slides.length > 1;

  return (
    <div
      className={
        hasNext
          ? "hero-promo-tile hero-promo-carousel has-next overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/50 shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
          : "hero-promo-tile hero-promo-carousel overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/50 shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
      }
      aria-roledescription="carousel"
      aria-label="Акции"
    >
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          className={
            i === safeIndex
              ? "hero-promo-carousel-slide is-active"
              : "hero-promo-carousel-slide"
          }
          aria-hidden={i !== safeIndex}
        >
          <PromoLinkedMedia
            src={slide.imageUrl}
            href={slide.href}
            eager={i === 0}
            label={`Акция ${i + 1}`}
          />
        </div>
      ))}
      {hasNext ? (
        <button
          type="button"
          className="hero-promo-next"
          aria-label="Следующая акция"
          onClick={next}
        >
          <ChevronDown className="hero-promo-next-icon" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
