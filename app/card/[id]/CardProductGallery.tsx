"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { StoredCard } from "@/app/api/cards/route";
import { focusToStyle } from "@/app/lib/imageFocus";
import { CardViewer } from "@/app/components/card-showcase";

type Props = {
  card: StoredCard;
  categoryCards: StoredCard[];
};

export function CardProductGallery({ card, categoryCards }: Props) {
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
    <div className="w-full">
      {hasVideo ? (
        <div className="mb-3 flex justify-center sm:justify-start">
          <button
            type="button"
            onClick={() => setVideoOpen(true)}
            className="text-sm font-medium text-purple-300 underline decoration-purple-500/50 underline-offset-4 transition hover:text-purple-200 hover:decoration-purple-400"
          >
            Смотреть видео
          </button>
        </div>
      ) : null}

      <CardViewer
        layout="product"
        activeCard={card}
        categoryCards={categoryCards}
      />

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
            <div className="mx-auto w-full max-w-full overflow-hidden rounded-xl border border-white/10 bg-black aspect-video max-h-[min(80vh,720px)]">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                playsInline
                className="h-full w-full bg-black object-cover"
                style={focusToStyle(card.productVideoFocus)}
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
