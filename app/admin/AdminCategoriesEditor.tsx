"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DraggableImageFrame } from "@/app/admin/components/DraggableImageFrame";
import type { CategoryTile } from "@/app/lib/categoriesJson";
import { DEFAULT_IMAGE_FOCUS } from "@/app/lib/imageFocus";
import { apiUrl } from "@/app/lib/apiUrl";

type Props = {
  /** Во вкладке админки — без ссылки «назад». */
  variant?: "page" | "embedded";
};

type UploadField = "banner" | "plate";

export function AdminCategoriesEditor({ variant = "page" }: Props) {
  const [cats, setCats] = useState<CategoryTile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/categories"))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: unknown) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          setCats(data as CategoryTile[]);
        }
      })
      .catch(() => {
        if (!cancelled) setCats([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/categories"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cats),
      });
      if (!res.ok) {
        window.alert("Не удалось сохранить.");
        return;
      }
      window.alert("Сохранено");
    } finally {
      setSaving(false);
    }
  };

  const upload = useCallback(
    async (file: File, index: number, field: UploadField) => {
      setUploadingKey(`${index}-${field}`);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("purpose", "logo");

        const res = await fetch(apiUrl("/api/upload"), {
          method: "POST",
          body: formData,
        });

        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          window.alert(data.error ?? "Ошибка загрузки");
          return;
        }

        setCats((prev) => {
          if (!prev[index]) return prev;
          const next = [...prev];
          if (field === "banner") {
            next[index] = {
              ...next[index],
              image: data.url!,
              imageFocus: DEFAULT_IMAGE_FOCUS,
            };
          } else {
            next[index] = {
              ...next[index],
              plateImage: data.url!,
              plateImageFocus: DEFAULT_IMAGE_FOCUS,
            };
          }
          return next;
        });
      } finally {
        setUploadingKey(null);
      }
    },
    []
  );

  const removeCategory = (index: number) => {
    if (!window.confirm("Удалить эту категорию из списка?")) return;
    setCats((prev) => prev.filter((_, i) => i !== index));
  };

  const clearPlate = (index: number) => {
    setCats((prev) => {
      if (!prev[index]) return prev;
      const next = [...prev];
      const row = { ...next[index] };
      delete row.plateImage;
      delete row.plateImageFocus;
      next[index] = row;
      return next;
    });
  };

  if (!loaded) {
    return (
      <div className={variant === "embedded" ? "py-4" : "p-10"}>
        <p className="text-zinc-400">Загрузка…</p>
      </div>
    );
  }

  const busy = uploadingKey !== null;

  return (
    <div className={variant === "embedded" ? "" : "p-10"}>
      {variant === "page" ? (
        <div className="mb-6">
          <Link
            href="/admin"
            className="text-sm text-purple-400 hover:text-purple-300"
          >
            ← Админ
          </Link>
        </div>
      ) : null}

      <h1
        className={
          variant === "embedded"
            ? "mb-4 text-lg font-semibold text-zinc-200"
            : "mb-6 text-2xl font-bold"
        }
      >
        Категории
      </h1>
      <p className="mb-6 max-w-2xl text-sm text-zinc-500">
        <span className="font-medium text-zinc-400">Баннер</span> — широкое
        фото раздела в коллекции.{" "}
        <span className="font-medium text-zinc-400">Плашка</span> — отдельное
        квадратное фото для полоски категорий вверху главной; если не задано,
        подставляется баннер.
      </p>

      {cats.map((cat, i) => (
        <div
          key={`${cat.name}-${i}`}
          className="mb-4 flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:flex-wrap lg:items-end"
        >
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Название</span>
            <input
              value={cat.name}
              onChange={(e) => {
                setCats((prev) => {
                  const next = structuredClone(prev);
                  next[i].name = e.target.value;
                  return next;
                });
              }}
              className="min-w-[200px] rounded-lg border border-white/20 bg-black p-2 text-white"
            />
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-xs text-zinc-500">Баннер раздела</span>
            <label className="flex cursor-pointer flex-col gap-1 text-xs text-zinc-400">
              {uploadingKey === `${i}-banner` ? "Загрузка…" : "Файл изображения"}
              <input
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file, i, "banner");
                  e.target.value = "";
                }}
                className="max-w-[220px] text-zinc-300 file:mr-2 file:rounded file:border-0 file:bg-purple-600 file:px-3 file:py-1.5 file:text-xs file:text-white"
              />
            </label>
            <div className="w-full max-w-[min(100%,320px)]">
              {cat.image ? (
                <DraggableImageFrame
                  src={cat.image}
                  value={cat.imageFocus ?? DEFAULT_IMAGE_FOCUS}
                  onChange={(v) => {
                    setCats((prev) => {
                      if (!prev[i]) return prev;
                      const next = [...prev];
                      next[i] = { ...next[i], imageFocus: v };
                      return next;
                    });
                  }}
                  aspectClass="aspect-[42/9]"
                  objectFit="contain"
                />
              ) : (
                <div className="flex aspect-[42/9] w-full max-w-[min(100%,420px)] items-center justify-center rounded-xl border border-white/10 bg-zinc-900 text-xs text-zinc-600">
                  нет баннера
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-xs text-zinc-500">Плашка в герое</span>
            <label className="flex cursor-pointer flex-col gap-1 text-xs text-zinc-400">
              {uploadingKey === `${i}-plate` ? "Загрузка…" : "Файл (квадрат)"}
              <input
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file, i, "plate");
                  e.target.value = "";
                }}
                className="max-w-[220px] text-zinc-300 file:mr-2 file:rounded file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:text-white"
              />
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-[72px] shrink-0">
                {cat.plateImage ? (
                  <DraggableImageFrame
                    src={cat.plateImage}
                    value={cat.plateImageFocus ?? DEFAULT_IMAGE_FOCUS}
                    onChange={(v) => {
                      setCats((prev) => {
                        if (!prev[i]) return prev;
                        const next = [...prev];
                        next[i] = { ...next[i], plateImageFocus: v };
                        return next;
                      });
                    }}
                    aspectClass="aspect-square"
                    objectFit="contain"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-dashed border-white/15 bg-zinc-900/80 px-1 text-center text-[10px] leading-tight text-zinc-500">
                    как баннер
                  </div>
                )}
              </div>
              {cat.plateImage ? (
                <button
                  type="button"
                  onClick={() => clearPlate(i)}
                  className="rounded border border-white/20 bg-black/50 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-white"
                >
                  Сбросить плашку
                </button>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={() => removeCategory(i)}
            className="rounded bg-red-600/90 px-3 py-2 text-sm text-white hover:bg-red-500 lg:ml-auto"
          >
            Удалить категорию
          </button>
        </div>
      ))}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() =>
            setCats((prev) => [
              ...prev,
              {
                name: "Новая категория",
                image: "",
                imageFocus: DEFAULT_IMAGE_FOCUS,
              },
            ])
          }
          className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
        >
          + категория
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-400 disabled:opacity-50"
        >
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
