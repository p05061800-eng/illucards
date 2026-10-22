"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import {
  emptyPromoSlide,
  parsePromoHomeConfig,
  type PromoCustomOrder,
  type PromoHomeConfig,
  type PromoSlide,
} from "@/app/lib/promoSlidesJson";
import { adminFetch } from "@/app/lib/adminFetch";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-base text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40";

export function AdminPromoSlidesEditor() {
  const [config, setConfig] = useState<PromoHomeConfig>(() =>
    parsePromoHomeConfig(null),
  );
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<{
    key: string;
    msg: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminFetch("/api/promo-slides")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: unknown) => {
        if (cancelled) return;
        setConfig(parsePromoHomeConfig(data));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const uploadImage = useCallback(async (key: string, file: File | null) => {
    if (!file) return;
    setUploadingKey(key);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file, file.name || "promo.jpg");
      fd.append("purpose", "promo");
      const res = await adminFetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (!res.ok || !data?.url) {
        const msg =
          typeof data?.error === "string"
            ? data.error
            : res.status === 401
              ? "Нужна авторизация администратора. Войдите в админку снова."
              : "Не удалось загрузить файл.";
        setUploadError({ key, msg });
        window.alert(msg);
        return;
      }
      const url = data.url;
      if (key === "custom") {
        setConfig((prev) => ({
          ...prev,
          customOrder: { ...prev.customOrder, imageUrl: url },
        }));
        return;
      }
      setConfig((prev) => ({
        ...prev,
        items: prev.items.map((x) =>
          x.id === key ? { ...x, imageUrl: url } : x,
        ),
      }));
    } catch {
      const msg = "Ошибка сети при загрузке.";
      setUploadError({ key, msg });
      window.alert(msg);
    } finally {
      setUploadingKey(null);
    }
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await adminFetch("/api/promo-slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        window.alert("Не удалось сохранить.");
        return;
      }
      const data = (await res.json()) as PromoHomeConfig;
      setConfig(parsePromoHomeConfig(data));
      window.alert("Сохранено");
    } finally {
      setSaving(false);
    }
  };

  const setCustom = useCallback((patch: Partial<PromoCustomOrder>) => {
    setConfig((prev) => ({
      ...prev,
      customOrder: { ...prev.customOrder, ...patch },
    }));
  }, []);

  const patchItem = useCallback((id: string, patch: Partial<PromoSlide>) => {
    setConfig((prev) => ({
      ...prev,
      items: prev.items.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  }, []);

  const moveItem = useCallback((index: number, dir: -1 | 1) => {
    setConfig((prev) => {
      const next = [...prev.items];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[j];
      next[j] = tmp;
      return { ...prev, items: next };
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setConfig((prev) => ({
      ...prev,
      items: prev.items.filter((x) => x.id !== id),
    }));
  }, []);

  const addItem = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      items: [...prev.items, emptyPromoSlide()],
    }));
  }, []);

  if (!loaded) {
    return <p className="text-sm text-zinc-500">Загрузка…</p>;
  }

  const custom = config.customOrder;

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Карточка на заказ
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Левая плашка на главной. На ней кнопки «Примеры» и «Заказать».
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,180px)_1fr] md:items-start">
            <ImageField
              imageUrl={custom.imageUrl}
              uploading={uploadingKey === "custom"}
              error={uploadError?.key === "custom" ? uploadError.msg : null}
              onFile={(f) => void uploadImage("custom", f)}
              onClear={() => setCustom({ imageUrl: "" })}
            />
            <PromoUrlField
              label="URL кнопки «Примеры»"
              placeholder="/card/id или https://…"
              value={custom.href}
              hint="«Заказать» всегда открывает существующий бот @illucards_bot (?start=custom_card). Пустая ссылка скрывает кнопку «Примеры»."
              onChange={(href) => setCustom({ href })}
            />
          </div>
        </div>
        <SaveButton saving={saving} onClick={() => void save()} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Акции
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Правая плашка — карусель изображений. Для каждой акции: картинка и
            необязательная ссылка при клике по изображению. Порядок сверху вниз
            совпадает с показом на сайте.
          </p>
        </div>

        <div className="space-y-4">
          {config.items.map((row, idx) => (
            <div
              key={row.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-violet-300/80">
                  Акция {idx + 1}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => moveItem(idx, -1)}
                    disabled={idx === 0}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-200 transition hover:border-violet-400/40 hover:bg-white/10 disabled:opacity-30"
                    aria-label="Выше"
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(idx, 1)}
                    disabled={idx === config.items.length - 1}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-200 transition hover:border-violet-400/40 hover:bg-white/10 disabled:opacity-30"
                    aria-label="Ниже"
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(row.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-500/25 bg-red-950/30 px-2.5 py-1 text-xs text-red-200 transition hover:border-red-400/50 hover:bg-red-900/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Удалить
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,180px)_1fr] md:items-start">
                <ImageField
                  imageUrl={row.imageUrl}
                  uploading={uploadingKey === row.id}
                  error={
                    uploadError?.key === row.id ? uploadError.msg : null
                  }
                  onFile={(f) => void uploadImage(row.id, f)}
                  onClear={() => patchItem(row.id, { imageUrl: "" })}
                />
                <div className="space-y-3">
                  <PromoUrlField
                    label="URL при клике по акции"
                    placeholder="/collection или https://…"
                    value={row.href}
                    hint="Пустое поле оставляет изображение без перехода. Кнопки «Примеры» и «Заказать» на акциях не показываются."
                    onChange={(href) => patchItem(row.id, { href })}
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={row.active}
                      onChange={(e) =>
                        patchItem(row.id, { active: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-white/20 bg-black/40 text-violet-500 focus:ring-violet-500/40"
                    />
                    Активна на главной
                  </label>
                  <p className="text-xs text-zinc-500">Порядок: {idx + 1}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-violet-400/40 hover:bg-white/10"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Добавить акцию
          </button>
          <SaveButton saving={saving} onClick={() => void save()} />
        </div>
      </section>
    </div>
  );
}

function PromoUrlField({
  label,
  placeholder,
  value,
  hint,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  hint: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="block">
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium text-zinc-400"
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="url"
        className={inputClass}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
      />
      <p className="mt-2 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

function SaveButton({
  saving,
  onClick,
}: {
  saving: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="rounded-full border border-violet-500/40 bg-violet-950/50 px-6 py-2.5 text-sm font-semibold text-violet-100 transition hover:border-violet-400/60 hover:bg-violet-900/60 disabled:opacity-40"
    >
      {saving ? "Сохранение…" : "Сохранить"}
    </button>
  );
}

function ImageField({
  imageUrl,
  uploading,
  error,
  onFile,
  onClear,
}: {
  imageUrl: string;
  uploading: boolean;
  error?: string | null;
  onFile: (file: File | null) => void;
  onClear: () => void;
}) {
  const inputId = useId();
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const preview = localPreview || imageUrl;

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="block text-xs font-medium text-zinc-400"
      >
        Изображение
      </label>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          className="aspect-[3/4] w-full rounded-lg border border-white/10 object-cover"
        />
      ) : (
        <div className="flex aspect-[3/4] w-full items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/40 text-xs text-zinc-500">
          Нет файла
        </div>
      )}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (localPreview) URL.revokeObjectURL(localPreview);
          if (f) {
            setLocalPreview(URL.createObjectURL(f));
            setFileName(f.name);
            void onFile(f);
          }
        }}
        className="block w-full max-w-full text-sm text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-violet-500"
      />
      {fileName ? (
        <p className="truncate text-xs text-zinc-500">Файл: {fileName}</p>
      ) : null}
      {uploading ? (
        <p className="text-xs text-violet-300/90">Загрузка…</p>
      ) : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {imageUrl ? (
        <button
          type="button"
          onClick={() => {
            if (localPreview) URL.revokeObjectURL(localPreview);
            setLocalPreview(null);
            setFileName(null);
            onClear();
          }}
          className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        >
          Убрать изображение
        </button>
      ) : null}
    </div>
  );
}
