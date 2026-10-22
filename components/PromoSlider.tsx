"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { apiUrl } from "@/app/lib/apiUrl";
import { getTelegramOrderBotUsername } from "@/app/lib/telegramOrderBotUsername";
import { telegramCustomCardOrderUrl } from "@/app/lib/telegramOrderStartPayload";
import {
  customOrderForHero,
  parsePromoHomeConfig,
  promoCarouselForHero,
  type PromoCustomOrder,
  type PromoHomeConfig,
  type PromoSlide,
} from "@/app/lib/promoSlidesJson";

type Props = {
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
  initialSlides = [],
  initialConfig,
}: Props) {
  const [config, setConfig] = useState<PromoHomeConfig>(() =>
    configFromProps(initialConfig, initialSlides),
  );

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
  }, []);

  const orderTile = customOrderForHero(config.customOrder);
  const promos = promoCarouselForHero(config.items);
  const colCount = (orderTile ? 1 : 0) + (promos.length > 0 ? 1 : 0);
  if (colCount === 0) return null;

  const pairClass =
    colCount === 1
      ? "hero-promo-pair hero-promo-pair--single"
      : "hero-promo-pair";

  return (
    <div className="hero-promo-slider w-full min-w-0">
      <div className={pairClass}>
        <div className="hero-promo-pair-grid">
          {orderTile ? (
            <PromoColumn title="Карточка на заказ">
              <StaticPromoTile slide={orderTile} eager />
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
  const orderHref = telegramCustomCardOrderUrl(getTelegramOrderBotUsername());
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
      <a
        href={orderHref}
        target="_blank"
        rel="noopener noreferrer"
        className="hero-promo-cta hero-promo-cta--order"
      >
        Заказать
      </a>
    </div>
  );
}

function StaticPromoTile({
  slide,
  eager,
}: {
  slide: PromoCustomOrder;
  eager?: boolean;
}) {
  return (
    <div className="hero-promo-tile overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/50 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
      <PromoLinkedMedia
        src={slide.imageUrl}
        href=""
        eager={eager}
        label="Карточка на заказ"
      />
      <PromoCtaStack examplesHref={slide.href.trim()} />
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
