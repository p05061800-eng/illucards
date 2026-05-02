"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { apiUrl } from "@/app/lib/apiUrl";
import type { PromoSlide } from "@/app/lib/promoSlidesJson";

import "swiper/css";

const AUTOPLAY_MS = 6000;

type Props = {
  initialSlides?: PromoSlide[];
};

export default function PromoSlider({ initialSlides = [] }: Props) {
  const [slides, setSlides] = useState<PromoSlide[]>(initialSlides);
  const [reduceMotion, setReduceMotion] = useState(false);

  const promoSnap = useMemo(
    () => JSON.stringify(initialSlides),
    [initialSlides]
  );

  /** Новые данные с сервера при навигации / RSC (не даём «залипнуть» только на клиенте). */
  useEffect(() => {
    try {
      const next = JSON.parse(promoSnap) as PromoSlide[];
      if (Array.isArray(next)) setSlides(next);
    } catch {
      /* ignore */
    }
  }, [promoSnap]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setReduceMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/promo-slides"))
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: unknown) => {
        if (cancelled || !data || typeof data !== "object") return;
        const items = (data as { items?: unknown }).items;
        if (!Array.isArray(items)) return;
        const next: PromoSlide[] = [];
        for (const x of items) {
          if (!x || typeof x !== "object") continue;
          const o = x as Record<string, unknown>;
          if (typeof o.id !== "string" || typeof o.imageUrl !== "string") continue;
          next.push({
            id: o.id,
            imageUrl: o.imageUrl,
            href: typeof o.href === "string" ? o.href : "",
          });
        }
        /**
         * Не затираем непустой витринный список пустым ответом API:
         * на Vercel без постоянного диска GET часто отдаёт «зашитый при деплое» JSON,
         * а после гидрации это выглядело как «пропала акция».
         */
        setSlides((prev) => {
          if (next.length > 0) return next;
          if (prev.length > 0) return prev;
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (slides.length === 0) return null;

  const single = slides.length === 1;
  const autoplayEnabled = !single && !reduceMotion;

  return (
    <div className="hero-promo-slider relative mt-2 w-full min-w-0 sm:mt-3">
      <div className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/50 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
        <Swiper
          modules={[Autoplay]}
          slidesPerView={1}
          loop={!single}
          speed={520}
          simulateTouch
          threshold={12}
          touchRatio={1}
          shortSwipes
          longSwipesRatio={0.35}
          autoplay={
            autoplayEnabled
              ? {
                  delay: AUTOPLAY_MS,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true,
                }
              : false
          }
          className="hero-promo-swiper w-full cursor-grab active:cursor-grabbing"
        >
          {slides.map((slide, i) => (
            <SwiperSlide key={slide.id} className="!h-auto">
              <div className="relative aspect-video w-full bg-zinc-900">
                <BannerSlide slide={slide} eager={i === 0} />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
}

function BannerSlide({ slide, eager }: { slide: PromoSlide; eager?: boolean }) {
  const href = slide.href?.trim();
  const src = slide.imageUrl?.trim() ?? "";
  const [loadFailed, setLoadFailed] = useState(false);

  const image = loadFailed || !src ? (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-zinc-900 px-4 text-center">
      <span className="text-xs font-medium text-zinc-400">Акция</span>
      <span className="text-[11px] leading-snug text-zinc-600">
        Не удалось загрузить баннер. Проверьте файл в админке или загрузите картинку заново.
      </span>
    </div>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- баннеры из /uploads/: next/image через _next/image часто даёт 404 на проде
    <img
      src={src}
      alt=""
      className="absolute inset-0 h-full w-full object-cover"
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setLoadFailed(true)}
    />
  );

  if (!href) {
    return image;
  }

  if (/^https?:\/\//i.test(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 z-[1] block outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
      >
        {image}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className="absolute inset-0 z-[1] block outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
    >
      {image}
    </Link>
  );
}
