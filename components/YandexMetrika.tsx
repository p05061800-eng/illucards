"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import {
  isTelegramExternalUrl,
  trackTelegramClick,
  YANDEX_METRIKA_ID,
} from "@/app/lib/yandexMetrika";

function pageUrl(pathname: string, searchParams: URLSearchParams): string {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function sendHit(url: string) {
  if (typeof window.ym !== "function" || !Number.isFinite(YANDEX_METRIKA_ID)) {
    return;
  }
  window.ym(YANDEX_METRIKA_ID, "hit", url);
}

function YandexMetrikaPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    sendHit(pageUrl(pathname, searchParams));
  }, [pathname, searchParams]);

  return null;
}

/** Отслеживает клики по ссылкам на t.me / telegram.me (соцсети, заказы, поддержка). */
function YandexMetrikaTelegramClickTracker() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;

      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || !isTelegramExternalUrl(href)) return;

      trackTelegramClick();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}

export function YandexMetrika() {
  if (!Number.isFinite(YANDEX_METRIKA_ID) || YANDEX_METRIKA_ID <= 0) {
    return null;
  }

  return (
    <>
      <Script
        id="yandex-metrika"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
(function(m,e,t,r,i,k,a){
  m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

ym(${YANDEX_METRIKA_ID}, "init", {
  defer: true,
  clickmap: true,
  trackLinks: true,
  accurateTrackBounce: true,
  webvisor: true
});
          `.trim(),
        }}
      />
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://mc.yandex.ru/watch/${YANDEX_METRIKA_ID}`}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
      <YandexMetrikaPageView />
      <YandexMetrikaTelegramClickTracker />
    </>
  );
}
