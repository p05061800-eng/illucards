"use client";

import { useCallback, useEffect, useState } from "react";
import type { SpotlightConfig, SpotlightSlideRow } from "@/app/lib/spotlightJson";
import { DEFAULT_SPOTLIGHT_SLIDES } from "@/app/lib/spotlightJson";
import { apiUrl } from "@/app/lib/apiUrl";

function newSlide(kind: SpotlightSlideRow["kind"], index: number): SpotlightSlideRow {
  if (kind === "novelties") {
    return {
      kind: "novelties",
      id: `novelties-${index}`,
      title: "Новинки",
      description: "Описание раздела.",
    };
  }
  return {
    kind: "promo",
    id: `promo-${index}`,
    title: "Новая подборка",
    description: "Текст подборки.",
    detailHref: "#collection",
    detailLabel: "Подробнее",
  };
}

export function AdminSpotlightEditor() {
  const [config, setConfig] = useState<SpotlightConfig>({
    slides: [...DEFAULT_SPOTLIGHT_SLIDES],
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/spotlight"))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: unknown) => {
        if (cancelled) return;
        if (data && typeof data === "object" && "slides" in data) {
          setConfig(data as SpotlightConfig);
        }
      })
      .catch(() => {})
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
      const res = await fetch(apiUrl("/api/spotlight"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
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

  const upload = useCallback(async (file: File, index: number) => {
    setUploadingIndex(index);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(apiUrl("/api/upload"), {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        window.alert(data.error ?? "Ошибка загрузки");
        return;
      }
      setConfig((prev) => {
        const slides = [...prev.slides];
        const row = slides[index];
        if (!row) return prev;
        slides[index] = { ...row, imageUrl: data.url! };
        return { slides };
      });
    } finally {
      setUploadingIndex(null);
    }
  }, []);

  const updateSlide = (index: number, patch: Partial<SpotlightSlideRow>) => {
    setConfig((prev) => {
      const slides = [...prev.slides];
      const row = slides[index];
      if (!row) return prev;
      slides[index] = { ...row, ...patch } as SpotlightSlideRow;
      return { slides };
    });
  };

  const removeSlide = (index: number) => {
    if (config.slides.length <= 1) {
      window.alert("Нужен хотя бы один слайд.");
      return;
    }
    if (!window.confirm("Удалить этот слайд?")) return;
    setConfig((prev) => ({
      slides: prev.slides.filter((_, i) => i !== index),
    }));
  };

  const addSlide = (kind: SpotlightSlideRow["kind"]) => {
    setConfig((prev) => ({
      slides: [...prev.slides, newSlide(kind, prev.slides.length)],
    }));
  };

  if (!loaded) {
    return <p className="text-zinc-500">Загрузка…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => addSlide("novelties")}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:border-purple-400/40 hover:bg-white/10"
        >
          + Слайд «Новинки»
        </button>
        <button
          type="button"
          onClick={() => addSlide("promo")}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:border-purple-400/40 hover:bg-white/10"
        >
          + Подборка / акция
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full border border-purple-500/40 bg-purple-950/50 px-5 py-2 text-sm font-medium text-purple-100 disabled:opacity-50"
        >
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
      </div>

      <ul className="space-y-10">
        {config.slides.map((slide, index) => (
          <li
            key={`${slide.id}-${index}`}
            className="rounded-2xl border border-white/10 bg-zinc-950/60 p-6"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Слайд {index + 1} ·{" "}
                {slide.kind === "novelties" ? "Новинки" : "Подборка"}
              </span>
              <button
                type="button"
                onClick={() => removeSlide(index)}
                className="text-sm text-red-400/90 hover:text-red-300"
              >
                Удалить слайд
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-[minmax(0,200px)_1fr]">
              <div>
                <p className="mb-2 text-xs text-zinc-500">Картинка</p>
                {slide.imageUrl ? (
                  <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slide.imageUrl}
                      alt=""
                      className="aspect-[3/4] w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/30 text-xs text-zinc-600">
                    Нет файла
                  </div>
                )}
                <label className="mt-3 flex cursor-pointer flex-col gap-2">
                  <span className="text-xs text-zinc-400">
                    {uploadingIndex === index ? "Загрузка…" : "Загрузить WebP/JPEG/PNG"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="text-sm text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5"
                    disabled={uploadingIndex === index}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void upload(f, index);
                    }}
                  />
                </label>
                {slide.imageUrl ? (
                  <button
                    type="button"
                    onClick={() => updateSlide(index, { imageUrl: undefined })}
                    className="mt-2 text-xs text-zinc-500 underline hover:text-zinc-300"
                  >
                    Убрать картинку
                  </button>
                ) : null}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">ID (латиница, уникально)</label>
                  <input
                    value={slide.id}
                    onChange={(e) => updateSlide(index, { id: e.target.value } as Partial<SpotlightSlideRow>)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Заголовок</label>
                  <input
                    value={slide.title}
                    onChange={(e) => updateSlide(index, { title: e.target.value } as Partial<SpotlightSlideRow>)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Текст</label>
                  <textarea
                    value={slide.description}
                    onChange={(e) =>
                      updateSlide(index, { description: e.target.value } as Partial<SpotlightSlideRow>)
                    }
                    rows={4}
                    className="w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </div>
                {slide.kind === "promo" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-zinc-500">Ссылка кнопки</label>
                      <input
                        value={slide.detailHref}
                        onChange={(e) =>
                          updateSlide(index, { detailHref: e.target.value } as Partial<SpotlightSlideRow>)
                        }
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-zinc-500">Текст кнопки</label>
                      <input
                        value={slide.detailLabel}
                        onChange={(e) =>
                          updateSlide(index, { detailLabel: e.target.value } as Partial<SpotlightSlideRow>)
                        }
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                      />
                    </div>
                  </div>
                ) : null}
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Тип слайда</label>
                  <select
                    value={slide.kind}
                    onChange={(e) => {
                      const k = e.target.value as SpotlightSlideRow["kind"];
                      if (k === slide.kind) return;
                      setConfig((prev) => {
                        const slides = [...prev.slides];
                        const base = {
                          id: slide.id,
                          title: slide.title,
                          description: slide.description,
                          ...(slide.imageUrl ? { imageUrl: slide.imageUrl } : {}),
                        };
                        slides[index] =
                          k === "novelties"
                            ? { kind: "novelties", ...base }
                            : {
                                kind: "promo",
                                ...base,
                                detailHref: "#collection",
                                detailLabel: "Подробнее",
                              };
                        return { slides };
                      });
                    }}
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  >
                    <option value="novelties">Новинки (карусель карточек isNew)</option>
                    <option value="promo">Подборка с кнопкой</option>
                  </select>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
