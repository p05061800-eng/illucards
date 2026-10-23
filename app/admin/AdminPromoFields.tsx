"use client";

import { useId, useState } from "react";

export const promoAdminInputClass =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-base text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40";

export function PromoUrlField({
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
        className={promoAdminInputClass}
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

export function SaveButton({
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

export function ImageField({
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
