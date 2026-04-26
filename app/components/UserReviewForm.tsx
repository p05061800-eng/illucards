"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PrivacyConsentCheckbox } from "@/app/components/PrivacyConsentCheckbox";

const MAX_IMAGES = 8;
const MAX_VIDEOS = 5;

const PURCHASED_LS_KEY = "illucards-purchased-cards";

function readPurchasedFromLocalStorage(cardId: string): boolean {
  try {
    const raw = localStorage.getItem(PURCHASED_LS_KEY);
    const p = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(p) && p.map(String).includes(cardId);
  } catch {
    return false;
  }
}

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.set("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Не удалось загрузить фото");
  if (!data.url) throw new Error("Нет URL");
  return data.url;
}

async function uploadReviewVideo(
  file: File,
  cardCategory: string
): Promise<string> {
  const fd = new FormData();
  fd.set("file", file);
  if (cardCategory.trim()) fd.set("cardCategory", cardCategory.trim());
  const res = await fetch("/api/upload-video", { method: "POST", body: fd });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Не удалось загрузить видео");
  if (!data.url) throw new Error("Нет URL");
  return data.url;
}

export function UserReviewForm({
  cardId,
  cardCategory = "",
  onSubmitted,
  embedded = false,
}: {
  cardId: string;
  /** Для TMNT-транскода на сервере при загрузке видео. */
  cardCategory?: string;
  onSubmitted?: () => void;
  /** Без внешней рамки и заголовка — внутри общего блока отзывов */
  embedded?: boolean;
}) {
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [privacyOk, setPrivacyOk] = useState(false);
  const [canReview, setCanReview] = useState<boolean | null>(null);

  useEffect(() => {
    let cancel = false;
    void fetch(`/api/purchases?cardId=${encodeURIComponent(cardId)}`)
      .then((r) => r.json())
      .then((d: { purchased?: boolean }) => {
        if (cancel) return;
        const server = Boolean(d.purchased);
        setCanReview(server || readPurchasedFromLocalStorage(cardId));
      })
      .catch(() => {
        if (!cancel) {
          setCanReview(readPurchasedFromLocalStorage(cardId));
        }
      });
    return () => {
      cancel = true;
    };
  }, [cardId]);

  const onPickImages = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setImageFiles((prev) => {
      const next = [...prev, ...files].slice(0, MAX_IMAGES);
      return next;
    });
    e.target.value = "";
  }, []);

  const onPickVideos = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setVideoFiles((prev) => {
      const next = [...prev, ...files].slice(0, MAX_VIDEOS);
      return next;
    });
    e.target.value = "";
  }, []);

  const removeImage = useCallback((i: number) => {
    setImageFiles((prev) => prev.filter((_, j) => j !== i));
  }, []);

  const removeVideo = useCallback((i: number) => {
    setVideoFiles((prev) => prev.filter((_, j) => j !== i));
  }, []);

  const submit = useCallback(async () => {
    setError(null);
    setOk(false);
    const t = text.trim();
    if (!privacyOk) {
      setError("Нужно согласие с политикой конфиденциальности.");
      return;
    }
    if (t.length < 5) {
      setError("Напишите отзыв хотя бы из нескольких слов (от 5 символов).");
      return;
    }
    setBusy(true);
    try {
      const imageUrls: string[] = [];
      for (const f of imageFiles) {
        imageUrls.push(await uploadImage(f));
      }
      const videoUrls: string[] = [];
      for (const f of videoFiles) {
        videoUrls.push(await uploadReviewVideo(f, cardCategory));
      }
      const res = await fetch("/api/user-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId,
          author: author.trim(),
          text: t,
          rating,
          images: imageUrls,
          videos: videoUrls,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Не удалось отправить отзыв");
      }
      setAuthor("");
      setText("");
      setRating(5);
      setImageFiles([]);
      setVideoFiles([]);
      setOk(true);
      setPrivacyOk(false);
      onSubmitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setBusy(false);
    }
  }, [
    author,
    text,
    rating,
    imageFiles,
    videoFiles,
    cardId,
    cardCategory,
    onSubmitted,
    privacyOk,
  ]);

  const shell =
    embedded
      ? "space-y-4"
      : "rounded-xl border border-white/10 bg-zinc-950/40 p-4 sm:p-5";

  if (canReview === null) {
    return (
      <div className={shell}>
        <p className="text-sm text-zinc-500">Проверка…</p>
      </div>
    );
  }

  if (!canReview) {
    return (
      <div className={shell}>
        <p className="text-sm leading-relaxed text-zinc-400">
          Отзыв можно оставить только после покупки этой карточки на сайте.
          Фото и видео не обязательны — достаточно оценки и текста.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/checkout"
            className="inline-flex rounded-lg border border-violet-500/45 bg-violet-950/50 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-900/60"
          >
            Перейти к оплате
          </Link>
          <Link
            href="/#collection"
            className="inline-flex rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/25 hover:text-white"
          >
            В каталог
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      {embedded ? null : (
        <>
          <h3 className="mb-3 text-base font-semibold text-white">Оставить отзыв</h3>
          <p className="mb-4 text-sm text-zinc-500">
            Фото и видео по желанию: до {MAX_IMAGES} фото и до {MAX_VIDEOS} роликов
            (MP4, WebM, MOV).
          </p>
        </>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-zinc-500">Оценка:</span>
        <div className="flex gap-1" role="group" aria-label="Оценка от 1 до 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={busy}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="rounded-md p-1 transition hover:bg-white/10 disabled:opacity-50"
              aria-label={`${n} из 5`}
            >
              <Star
                className={`h-7 w-7 ${
                  n <= (hover || rating)
                    ? "fill-amber-400 text-amber-400"
                    : "fill-zinc-600 text-zinc-600"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-medium text-zinc-500">
          Имя (необязательно)
        </span>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          maxLength={80}
          disabled={busy}
          className="w-full rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
          placeholder="Покупатель"
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-medium text-zinc-500">
          Текст отзыва
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
          rows={4}
          maxLength={2000}
          className="w-full resize-y rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
          placeholder="Как вам карточка?"
        />
      </label>

      <div className="mb-3 flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300 transition hover:border-white/20">
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={busy || imageFiles.length >= MAX_IMAGES}
            className="sr-only"
            onChange={onPickImages}
          />
          Добавить фото
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300 transition hover:border-white/20">
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
            multiple
            disabled={busy || videoFiles.length >= MAX_VIDEOS}
            className="sr-only"
            onChange={onPickVideos}
          />
          Добавить видео
        </label>
      </div>

      {imageFiles.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-2 text-xs text-zinc-400">
          {imageFiles.map((f, i) => (
            <li
              key={`${f.name}-img-${i}`}
              className="flex items-center gap-1 rounded-md border border-white/10 bg-black/30 px-2 py-1"
            >
              <span className="max-w-[140px] truncate">{f.name}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => removeImage(i)}
                className="text-rose-400 hover:underline"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {videoFiles.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-2 text-xs text-zinc-400">
          {videoFiles.map((f, i) => (
            <li
              key={`${f.name}-vid-${i}`}
              className="flex items-center gap-1 rounded-md border border-white/10 bg-black/30 px-2 py-1"
            >
              <span className="max-w-[140px] truncate">{f.name}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => removeVideo(i)}
                className="text-rose-400 hover:underline"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="mb-2 text-sm text-rose-400" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="mb-2 text-sm text-emerald-400">
          Спасибо! Отзыв опубликован.
        </p>
      ) : null}

      <div className="mb-4">
        <PrivacyConsentCheckbox
          id={`review-privacy-${cardId}`}
          checked={privacyOk}
          onChange={setPrivacyOk}
          disabled={busy}
        />
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="rounded-lg border border-purple-500/45 bg-purple-950/50 px-5 py-2.5 text-sm font-semibold text-purple-100 transition hover:bg-purple-900/60 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Отправка…" : "Отправить отзыв"}
      </button>
    </div>
  );
}
