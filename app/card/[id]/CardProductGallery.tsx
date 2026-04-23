"use client";

import { Play } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { StoredCard } from "@/app/api/cards/route";
import { focusObjectPositionOnly } from "@/app/lib/imageFocus";
import { CardViewer } from "@/app/components/card-showcase";

type Props = {
  card: StoredCard;
  /** Порядок листания стрелками и свайпом (категория или весь каталог). */
  browseCards: StoredCard[];
};

export function CardProductGallery({ card, browseCards }: Props) {
  const videoUrl = card.productVideo?.trim() ?? "";
  const hasVideo = videoUrl.length > 0;
  const [videoOpen, setVideoOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!videoOpen) {
      videoRef.current?.pause();
    }
  }, [videoOpen]);

  useEffect(() => {
    if (!videoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVideoOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [videoOpen]);

  return (
    <div className="relative z-10 w-full overflow-visible pb-2 pt-0 sm:pb-3 sm:pt-0">
      <CardViewer
        layout="product"
        activeCard={card}
        browseCards={browseCards}
      />

      {hasVideo ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2 sm:mt-4 sm:justify-start sm:gap-3">
          <button
            type="button"
            onClick={() => setVideoOpen(true)}
            className="relative z-10 inline-flex items-center gap-1.5 rounded-lg border border-purple-400/55 bg-purple-950/70 px-3 py-2 text-xs font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] ring-1 ring-white/10 transition hover:border-purple-300/80 hover:bg-purple-900/85 hover:shadow-[0_0_28px_rgba(192,132,252,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 sm:text-sm"
          >
            <Play className="h-3.5 w-3.5 shrink-0 fill-white text-white sm:h-4 sm:w-4" aria-hidden />
            Смотреть видео
          </button>
        </div>
      ) : null}

      {hasVideo && videoOpen ? (
        <div
          className="fixed inset-0 z-[420] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={() => setVideoOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl rounded-2xl border border-white/15 bg-zinc-950 p-3 shadow-2xl shadow-purple-950/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <p id={titleId} className="text-sm font-semibold text-zinc-200">
                Видео товара
              </p>
              <button
                type="button"
                onClick={() => setVideoOpen(false)}
                className="rounded-lg border border-white/15 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-white/25 hover:bg-zinc-800"
              >
                Закрыть
              </button>
            </div>
            <div className="mx-auto w-full max-w-full overflow-visible rounded-xl border border-white/10 bg-black">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                playsInline
                className="block h-auto w-full bg-black"
                style={{
                  ...focusObjectPositionOnly(card.productVideoFocus),
                  objectFit: "unset",
                }}
                preload="metadata"
              >
                <track kind="captions" />
              </video>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
