"use client";

import { useEffect, useRef, useState } from "react";
import { categories } from "@/data/categories";
import { DraggableImageFrame } from "./components/DraggableImageFrame";
import { DraggableVideoFrame } from "./components/DraggableVideoFrame";
import type { StoredCard } from "../api/cards/route";
import { DEFAULT_IMAGE_FOCUS } from "../lib/imageFocus";
import { apiUrl } from "../lib/apiUrl";

type AdminCardFormProps = {
  editingCard?: StoredCard | null;
  onCancelEdit?: () => void;
  onSuccess?: () => void;
};

async function uploadImageFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(apiUrl("/api/upload"), { method: "POST", body: fd });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Ошибка загрузки"
    );
  }
  return data.url;
}

async function uploadVideoFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(apiUrl("/api/upload-video"), {
    method: "POST",
    body: fd,
  });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Ошибка загрузки видео"
    );
  }
  return data.url;
}

export function AdminCardForm({
  editingCard = null,
  onCancelEdit,
  onSuccess,
}: AdminCardFormProps) {
  const isEdit = Boolean(editingCard);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(
    categories[0]?.name ?? "Marvel"
  );
  const [categoryBgUrl, setCategoryBgUrl] = useState<string | null>(null);
  const [effect, setEffect] = useState<"vario" | "3d-horizontal">(
    "3d-horizontal"
  );
  const [price, setPrice] = useState("");
  const [rarity, setRarity] = useState("limited");
  const [frontImageUrl, setFrontImageUrl] = useState<string | null>(null);
  const [backImageUrl, setBackImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const categoryBgRef = useRef<HTMLInputElement>(null);
  const productVideoFileRef = useRef<HTMLInputElement>(null);
  const [productVideo, setProductVideo] = useState("");
  const [inStock, setInStock] = useState(true);
  const [ratingAvg, setRatingAvg] = useState("4.8");
  const [reviewCount, setReviewCount] = useState("0");
  const [reviewsJson, setReviewsJson] = useState("");
  const [boughtTogetherIds, setBoughtTogetherIds] = useState("");
  const [recommendedIds, setRecommendedIds] = useState("");
  const [frontFocus, setFrontFocus] = useState(DEFAULT_IMAGE_FOCUS);
  const [backFocus, setBackFocus] = useState(DEFAULT_IMAGE_FOCUS);
  const [categoryBgFocus, setCategoryBgFocus] = useState(DEFAULT_IMAGE_FOCUS);
  const [videoFocus, setVideoFocus] = useState(DEFAULT_IMAGE_FOCUS);

  useEffect(() => {
    if (!editingCard) {
      setFrontImageUrl(null);
      setBackImageUrl(null);
      setCategoryBgUrl(null);
      setFrontFocus(DEFAULT_IMAGE_FOCUS);
      setBackFocus(DEFAULT_IMAGE_FOCUS);
      setCategoryBgFocus(DEFAULT_IMAGE_FOCUS);
      setVideoFocus(DEFAULT_IMAGE_FOCUS);
      return;
    }
    setTitle(editingCard.title ?? "");
    setDescription(editingCard.description ?? "");
    const cat = editingCard.category?.trim() ?? "";
    const catOk = categories.some((c) => c.name === cat);
    setCategory(catOk && cat ? cat : categories[0].name);
    const eff =
      editingCard.effect?.trim() === "vario" ? "vario" : "3d-horizontal";
    setEffect(eff);
    setPrice(
      editingCard.price !== undefined && editingCard.price !== null
        ? String(editingCard.price)
        : ""
    );
    setRarity(editingCard.rarity ?? "limited");
    setFrontImageUrl(editingCard.frontImage?.trim() || null);
    setBackImageUrl(
      eff === "vario" ? editingCard.backImage?.trim() || null : null
    );
    setCategoryBgUrl(editingCard.categoryBg?.trim() || null);
    setProductVideo(editingCard.productVideo?.trim() ?? "");
    setVideoFocus(editingCard.productVideoFocus ?? DEFAULT_IMAGE_FOCUS);
    setInStock(editingCard.inStock !== false);
    setRatingAvg(
      editingCard.ratingAvg != null ? String(editingCard.ratingAvg) : "4.8"
    );
    setReviewCount(
      editingCard.reviewCount != null ? String(editingCard.reviewCount) : "0"
    );
    setReviewsJson(
      editingCard.reviews?.length
        ? JSON.stringify(editingCard.reviews, null, 2)
        : ""
    );
    setBoughtTogetherIds(
      editingCard.boughtTogetherIds?.join(", ") ?? ""
    );
    setRecommendedIds(editingCard.recommendedIds?.join(", ") ?? "");
    setFrontFocus(editingCard.frontImageFocus ?? DEFAULT_IMAGE_FOCUS);
    setBackFocus(editingCard.backImageFocus ?? DEFAULT_IMAGE_FOCUS);
    setCategoryBgFocus(editingCard.categoryBgFocus ?? DEFAULT_IMAGE_FOCUS);
    setStatus("idle");
    setMessage("");
  }, [editingCard]);

  async function onFrontChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus("loading");
    setMessage("Загрузка лицевой стороны…");
    try {
      const url = await uploadImageFile(file);
      setFrontImageUrl(url);
      setFrontFocus(DEFAULT_IMAGE_FOCUS);
      setStatus("idle");
      setMessage("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  }

  async function onBackChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus("loading");
    setMessage("Загрузка оборота…");
    try {
      const url = await uploadImageFile(file);
      setBackImageUrl(url);
      setBackFocus(DEFAULT_IMAGE_FOCUS);
      setStatus("idle");
      setMessage("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  }

  async function onCategoryBgChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const url = await uploadImageFile(file);
      setCategoryBgUrl(url);
      setCategoryBgFocus(DEFAULT_IMAGE_FOCUS);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  }

  async function onProductVideoFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus("loading");
    setMessage("Загрузка видео…");
    try {
      const url = await uploadVideoFile(file);
      setProductVideo(url);
      setVideoFocus(DEFAULT_IMAGE_FOCUS);
      setStatus("idle");
      setMessage("Видео загружено — сохраните карточку.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!frontImageUrl?.trim()) {
      setStatus("error");
      setMessage("Загрузите лицевую сторону (файл).");
      return;
    }
    if (effect === "vario" && !backImageUrl?.trim()) {
      setStatus("error");
      setMessage("Для Vario загрузите оборотную сторону (второе изображение).");
      return;
    }

    setStatus("loading");
    setMessage("");

    const fd = new FormData();
    if (isEdit && editingCard) {
      fd.set("cardId", editingCard.id);
    }
    fd.set("title", title);
    fd.set("description", description);
    fd.set("category", category);
    fd.set("effect", effect);
    fd.set("price", price.trim() === "" ? "0" : price.trim());
    fd.set("rarity", rarity);

    fd.set("frontImageUrl", frontImageUrl);
    fd.set("backImageUrl", effect === "vario" ? (backImageUrl ?? "") : "");
    if (categoryBgUrl?.trim()) {
      fd.set("categoryBgUrl", categoryBgUrl);
    }

    fd.set("productVideo", productVideo.trim());
    if (inStock) {
      fd.set("inStock", "on");
    }
    fd.set("ratingAvg", ratingAvg.trim() || "4.8");
    fd.set("reviewCount", reviewCount.trim() || "0");
    fd.set("reviewsJson", reviewsJson.trim());
    fd.set("boughtTogetherIds", boughtTogetherIds.trim());
    fd.set("recommendedIds", recommendedIds.trim());
    fd.set("frontImageFocus", JSON.stringify(frontFocus));
    fd.set("backImageFocus", JSON.stringify(backFocus));
    fd.set("categoryBgFocus", JSON.stringify(categoryBgFocus));
    fd.set("productVideoFocus", JSON.stringify(videoFocus));

    try {
      const res = await fetch(apiUrl("/api/cards"), {
        method: isEdit ? "PATCH" : "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(
          typeof data.error === "string" ? data.error : "Не удалось сохранить."
        );
        return;
      }
      setStatus("success");
      setMessage(isEdit ? "Изменения сохранены." : "Карточка добавлена.");
      onSuccess?.();
      if (!isEdit) {
        setTitle("");
        setDescription("");
        setCategory(categories[0].name);
        setCategoryBgUrl(null);
        setEffect("3d-horizontal");
        setPrice("");
        setRarity("limited");
        setFrontImageUrl(null);
        setBackImageUrl(null);
        if (frontRef.current) frontRef.current.value = "";
        if (backRef.current) backRef.current.value = "";
        if (categoryBgRef.current) categoryBgRef.current.value = "";
        setFrontFocus(DEFAULT_IMAGE_FOCUS);
        setBackFocus(DEFAULT_IMAGE_FOCUS);
        setCategoryBgFocus(DEFAULT_IMAGE_FOCUS);
        setProductVideo("");
        setVideoFocus(DEFAULT_IMAGE_FOCUS);
      }
    } catch {
      setStatus("error");
      setMessage("Ошибка сети. Попробуйте снова.");
    }
  }

  const inputClass =
    "w-full rounded-xl border border-purple-500/15 bg-black/50 px-4 py-3 text-white placeholder:text-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:shadow-[0_0_24px_rgba(168,85,247,0.15)]";

  const selectClass =
    "w-full rounded-xl border border-purple-500/15 bg-black/50 px-4 py-3 text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:shadow-[0_0_24px_rgba(168,85,247,0.15)]";

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-lg space-y-6 rounded-2xl border border-purple-500/25 bg-gradient-to-b from-purple-950/30 to-black/50 p-8 shadow-[0_0_60px_rgba(88,28,135,0.2)] backdrop-blur-xl"
    >
      <div>
        <label
          htmlFor="title"
          className="mb-2 block text-sm font-medium text-zinc-300"
        >
          Название
        </label>
        <input
          id="title"
          name="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={inputClass}
          placeholder="Например, Карточка #7"
        />
      </div>

      <div>
        <label
          htmlFor="category"
          className="mb-2 block text-sm font-medium text-zinc-300"
        >
          Категория
        </label>
        <select
          id="category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={selectClass}
        >
          {categories.map((c) => (
            <option key={c.slug} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="categoryBgFile"
          className="mb-2 block text-sm font-medium text-zinc-300"
        >
          Фон категории (изображение)
          {isEdit ? (
            <span className="mt-0.5 block text-xs font-normal text-zinc-500">
              Необязательно — оставьте пустым, чтобы не менять
            </span>
          ) : null}
        </label>
        <input
          id="categoryBgFile"
          name="categoryBgFile"
          ref={categoryBgRef}
          type="file"
          accept="image/*"
          onChange={onCategoryBgChange}
          className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-purple-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-purple-500"
        />
        {categoryBgUrl ? (
          <div className="mt-2 w-full max-w-[240px]">
            <DraggableImageFrame
              src={categoryBgUrl}
              value={categoryBgFocus}
              onChange={setCategoryBgFocus}
              aspectClass="aspect-[3/4]"
            />
          </div>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="effect"
          className="mb-2 block text-sm font-medium text-zinc-300"
        >
          Эффект карточки
        </label>
        <p className="mb-2 text-xs text-zinc-500">
          <strong>3D</strong> — одна картинка, наклон без смены лиц/оборота.{" "}
          <strong>Vario</strong> — две стороны и эффект варио.
        </p>
        <select
          id="effect"
          name="effect"
          value={effect}
          onChange={(e) => {
            const v = e.target.value === "vario" ? "vario" : "3d-horizontal";
            setEffect(v);
            if (v === "3d-horizontal") {
              setBackImageUrl(null);
              if (backRef.current) backRef.current.value = "";
            }
          }}
          className={selectClass}
        >
          <option value="3d-horizontal">3D</option>
          <option value="vario">Vario</option>
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="price"
            className="mb-2 block text-sm font-medium text-zinc-300"
          >
            Цена (BYN)
          </label>
          <input
            id="price"
            name="price"
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="rarity"
            className="mb-2 block text-sm font-medium text-zinc-300"
          >
            Редкость
          </label>
          <select
            id="rarity"
            name="rarity"
            value={rarity}
            onChange={(e) => setRarity(e.target.value)}
            className={selectClass}
          >
            <option value="common">Обычная</option>
            <option value="limited">Лимитированная</option>
            <option value="adult">18+</option>
            <option value="novelty">Новинки</option>
            <option value="hot_price">Горячая цена</option>
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="description"
          className="mb-2 block text-sm font-medium text-zinc-300"
        >
          Описание
        </label>
        <textarea
          id="description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className={`${inputClass} resize-y`}
          placeholder="Краткое описание карточки"
        />
      </div>

      <div>
        <label
          htmlFor="productVideo"
          className="mb-2 block text-sm font-medium text-zinc-300"
        >
          Видео на странице товара
        </label>
        <p className="mb-2 text-xs text-zinc-500">
          Любое разрешение и соотношение сторон (MP4, WebM, MOV, до 120 МБ).
          Ниже можно сдвинуть кадр в рамке превью — так же будет на сайте.
          Открытие по кнопке «Смотреть видео».
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            id="productVideo"
            name="productVideo"
            type="text"
            value={productVideo}
            onChange={(e) => setProductVideo(e.target.value)}
            className={`${inputClass} min-w-0 flex-1 font-mono text-sm`}
            placeholder="https://… или /uploads/videos/…"
          />
          <input
            ref={productVideoFileRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
            className="hidden"
            onChange={onProductVideoFileChange}
          />
          <button
            type="button"
            onClick={() => productVideoFileRef.current?.click()}
            className="shrink-0 rounded-lg border border-purple-500/40 bg-purple-950/40 px-4 py-2.5 text-sm font-medium text-purple-100 transition hover:border-purple-400/60 hover:bg-purple-900/50"
          >
            Загрузить видео
          </button>
        </div>
        {productVideo.trim() ? (
          <div className="mt-4 w-full max-w-xl">
            <DraggableVideoFrame
              src={productVideo.trim()}
              value={videoFocus}
              onChange={setVideoFocus}
            />
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <input
          id="inStock"
          name="inStock"
          type="checkbox"
          checked={inStock}
          onChange={(e) => setInStock(e.target.checked)}
          className="h-4 w-4 rounded border-purple-500/40 text-purple-600"
        />
        <label htmlFor="inStock" className="text-sm text-zinc-300">
          В наличии
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="ratingAvg"
            className="mb-2 block text-sm font-medium text-zinc-300"
          >
            Средняя оценка (0–5)
          </label>
          <input
            id="ratingAvg"
            name="ratingAvg"
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={ratingAvg}
            onChange={(e) => setRatingAvg(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="reviewCount"
            className="mb-2 block text-sm font-medium text-zinc-300"
          >
            Число отзывов
          </label>
          <input
            id="reviewCount"
            name="reviewCount"
            type="number"
            min={0}
            value={reviewCount}
            onChange={(e) => setReviewCount(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="reviewsJson"
          className="mb-2 block text-sm font-medium text-zinc-300"
        >
          Отзывы (JSON-массив)
        </label>
        <textarea
          id="reviewsJson"
          name="reviewsJson"
          value={reviewsJson}
          onChange={(e) => setReviewsJson(e.target.value)}
          rows={6}
          className={`${inputClass} resize-y font-mono text-xs`}
          placeholder={`[\n  { "author": "Имя", "rating": 5, "text": "Текст", "date": "2025-01-15" }\n]`}
        />
      </div>

      <div>
        <label
          htmlFor="boughtTogetherIds"
          className="mb-2 block text-sm font-medium text-zinc-300"
        >
          «Вместе покупают» — id через запятую
        </label>
        <input
          id="boughtTogetherIds"
          name="boughtTogetherIds"
          type="text"
          value={boughtTogetherIds}
          onChange={(e) => setBoughtTogetherIds(e.target.value)}
          className={inputClass}
          placeholder="uuid1, uuid2"
        />
      </div>

      <div>
        <label
          htmlFor="recommendedIds"
          className="mb-2 block text-sm font-medium text-zinc-300"
        >
          Рекомендуем — id через запятую
        </label>
        <input
          id="recommendedIds"
          name="recommendedIds"
          type="text"
          value={recommendedIds}
          onChange={(e) => setRecommendedIds(e.target.value)}
          className={inputClass}
          placeholder="uuid1, uuid2"
        />
      </div>

      <div>
        <label
          htmlFor="frontImage"
          className="mb-2 block text-sm font-medium text-zinc-300"
        >
          Лицевая сторона
          {isEdit ? (
            <span className="mt-0.5 block text-xs font-normal text-zinc-500">
              Загрузите файл только если нужно заменить изображение
            </span>
          ) : null}
        </label>
        <input
          ref={frontRef}
          id="frontImage"
          name="frontImage"
          type="file"
          accept="image/*"
          onChange={onFrontChange}
          className="block w-full cursor-pointer text-sm text-zinc-400 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-purple-600 file:to-violet-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:shadow-[0_0_16px_rgba(168,85,247,0.35)] hover:file:from-purple-500 hover:file:to-violet-500"
        />
        {frontImageUrl ? (
          <div className="mt-4 w-full max-w-[240px] border border-purple-500/20 ring-1 ring-purple-500/10">
            <DraggableImageFrame
              src={frontImageUrl}
              value={frontFocus}
              onChange={setFrontFocus}
              aspectClass="aspect-[3/4]"
            />
          </div>
        ) : null}
      </div>

      {effect === "vario" ? (
      <div>
        <label
          htmlFor="backImage"
          className="mb-2 block text-sm font-medium text-zinc-300"
        >
          Оборотная сторона (Vario)
          {isEdit ? (
            <span className="mt-0.5 block text-xs font-normal text-zinc-500">
              Загрузите файл только если нужно заменить изображение
            </span>
          ) : null}
        </label>
        <input
          ref={backRef}
          id="backImage"
          name="backImage"
          type="file"
          accept="image/*"
          onChange={onBackChange}
          className="block w-full cursor-pointer text-sm text-zinc-400 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-purple-600 file:to-violet-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:shadow-[0_0_16px_rgba(168,85,247,0.35)] hover:file:from-purple-500 hover:file:to-violet-500"
        />
        {backImageUrl ? (
          <div className="mt-4 w-full max-w-[240px] border border-purple-500/20 ring-1 ring-purple-500/10">
            <DraggableImageFrame
              src={backImageUrl}
              value={backFocus}
              onChange={setBackFocus}
              aspectClass="aspect-[3/4]"
            />
          </div>
        ) : null}
      </div>
      ) : null}

      {message ? (
        <p
          className={
            status === "error"
              ? "text-sm text-red-400"
              : "text-sm text-emerald-400"
          }
        >
          {message}
        </p>
      ) : null}

      <div
        className={`flex flex-col gap-3 ${isEdit ? "sm:flex-row sm:items-stretch" : ""}`}
      >
        {isEdit ? (
          <button
            type="button"
            onClick={() => onCancelEdit?.()}
            className="w-full rounded-xl border border-white/20 bg-black/30 px-6 py-3.5 text-sm font-semibold text-zinc-200 transition hover:border-white/30 hover:bg-white/5 sm:w-auto sm:shrink-0"
          >
            Отмена
          </button>
        ) : null}
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full flex-1 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 px-6 py-3.5 font-semibold text-white shadow-[0_0_32px_rgba(168,85,247,0.4)] ring-1 ring-purple-400/30 transition hover:from-purple-500 hover:via-violet-500 hover:to-fuchsia-500 hover:shadow-[0_0_44px_rgba(192,132,252,0.5)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading"
            ? "Сохранение…"
            : isEdit
              ? "Сохранить"
              : "Добавить карточку"}
        </button>
      </div>
    </form>
  );
}
