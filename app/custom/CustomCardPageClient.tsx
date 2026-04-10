"use client";

import { useEffect, useMemo, useState } from "react";
import { CustomCardPreview } from "../components/CustomCardPreview";
import { PurchaseModal } from "../components/PurchaseModal";
import { useCurrency } from "../context/CurrencyContext";
import { formatCardPrice } from "../lib/formatPrice";
import { categories } from "@/data/categories";
import { getCategoryBackgroundUrl } from "../lib/categoryBackground";

const CUSTOM_CATEGORIES: { slug: string; label: string }[] = [
  { slug: "", label: "Без вселенной" },
  ...categories.map((c) => ({ slug: c.slug, label: c.name })),
];

/** Кастомная карточка — цена в BYN */
const CUSTOM_CARD_PRICE_BYN = 30;

export default function CustomCardPageClient() {
  const { currency } = useCurrency();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [effect, setEffect] = useState<"3d-horizontal" | "vario">(
    "3d-horizontal"
  );
  const [submitOpen, setSubmitOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const auraUrl = useMemo(() => {
    if (!category) return null;
    return getCategoryBackgroundUrl(category);
  }, [category]);

  function handleFileChange(f: File | null) {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!f.type.startsWith("image/")) {
      setError("Загрузите файл изображения");
      setFile(null);
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setError("Файл больше 8 МБ");
      setFile(null);
      return;
    }
    setFile(f);
  }

  function handleCreate() {
    setError(null);
    if (!name.trim()) {
      setError("Введите название карточки");
      return;
    }
    if (!file || !previewUrl) {
      setError("Загрузите изображение");
      return;
    }
    setSubmitOpen(true);
  }

  return (
    <>
      <PurchaseModal open={submitOpen} onClose={() => setSubmitOpen(false)} />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
        <div className="mb-10 text-center">
          <h1 className="bg-gradient-to-r from-white via-purple-100 to-violet-200 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
            Своя карточка
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-zinc-400">
            Загрузите изображение, задайте название и смотрите живой предпросмотр
            с эффектами 3D и Vario.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-start lg:gap-12">
          <div className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <div>
              <label
                htmlFor="custom-image"
                className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500"
              >
                Изображение
              </label>
              <input
                id="custom-image"
                type="file"
                accept="image/*"
                onChange={(e) =>
                  handleFileChange(e.target.files?.[0] ?? null)
                }
                className="block w-full cursor-pointer text-sm text-zinc-300 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-purple-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-purple-500"
              />
            </div>

            <div>
              <label
                htmlFor="custom-name"
                className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500"
              >
                Название
              </label>
              <input
                id="custom-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например, Мой герой"
                className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              />
            </div>

            <div>
              <label
                htmlFor="custom-category"
                className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500"
              >
                Вселенная
              </label>
              <select
                id="custom-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full cursor-pointer rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-white focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              >
                {CUSTOM_CATEGORIES.map((c) => (
                  <option key={c.slug || "none"} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Эффект
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setEffect("3d-horizontal")}
                  className={`rounded-full border px-5 py-2.5 text-sm font-medium transition ${
                    effect === "3d-horizontal"
                      ? "border-purple-400/60 bg-purple-950/60 text-white shadow-[0_0_24px_rgba(168,85,247,0.35)]"
                      : "border-white/15 bg-black/30 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                  }`}
                >
                  3D
                </button>
                <button
                  type="button"
                  onClick={() => setEffect("vario")}
                  className={`rounded-full border px-5 py-2.5 text-sm font-medium transition ${
                    effect === "vario"
                      ? "border-purple-400/60 bg-purple-950/60 text-white shadow-[0_0_24px_rgba(168,85,247,0.35)]"
                      : "border-white/15 bg-black/30 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                  }`}
                >
                  Vario
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 px-4 py-3 text-center">
              <p className="text-xs text-zinc-500">Стоимость кастомной карточки</p>
              <p className="mt-1 bg-gradient-to-r from-purple-200 to-violet-200 bg-clip-text text-lg font-semibold leading-snug text-transparent sm:text-2xl">
                {formatCardPrice(CUSTOM_CARD_PRICE_BYN, currency)}
              </p>
            </div>

            {error ? (
              <p className="text-sm text-red-400/90" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleCreate}
              className="w-full rounded-full bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 py-4 text-base font-semibold text-white shadow-[0_0_40px_rgba(168,85,247,0.45)] ring-1 ring-purple-400/40 transition hover:from-purple-500 hover:via-violet-500 hover:to-fuchsia-500 hover:shadow-[0_0_56px_rgba(192,132,252,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/90 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Создать карточку
            </button>
          </div>

          <div>
            <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-zinc-500">
              Предпросмотр
            </p>
            <CustomCardPreview
              imageUrl={previewUrl}
              effect={effect}
              title={name}
              categoryBackgroundUrl={auraUrl}
            />
            <p className="mt-4 text-center text-xs text-zinc-500">
              Наведите курсор на карточку, чтобы увидеть эффект
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
