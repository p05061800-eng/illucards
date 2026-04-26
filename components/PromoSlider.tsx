"use client";

import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";

/**
 * Ассеты из `public/` отдаются по URL `/имя.jpg`, без `import` через `@/public/…`
 * (иначе TypeScript/сборщик ищут модуль и падают, если путь не настроен как asset).
 */
const PROMO_IMAGE_SRC = "/promo.jpg";

export default function PromoSlider() {
  return (
    <div className="w-full">
      <Swiper spaceBetween={12} slidesPerView={1.1} className="w-full">
        <SwiperSlide className="!h-auto">
          <Image
            src={PROMO_IMAGE_SRC}
            alt="Промо"
            width={1200}
            height={400}
            className="h-auto w-full rounded-xl object-cover"
            sizes="(max-width: 768px) 100vw, 1200px"
            priority
          />
        </SwiperSlide>
      </Swiper>
    </div>
  );
}
