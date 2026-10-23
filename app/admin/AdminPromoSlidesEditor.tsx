"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import {
  emptyPromoSlide,
  parsePromoHomeConfig,
  type PromoCustomOrder,
  type PromoHomeConfig,
  type PromoSlide,
} from "@/app/lib/promoSlidesJson";
import { adminFetch, readAdminError } from "@/app/lib/adminFetch";
import { AdminCustomOrderCardsEditor } from "./AdminCustomOrderCardsEditor";
import {
  ImageField,
  PromoUrlField,
  SaveButton,
} from "./AdminPromoFields";

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
        window.alert(await readAdminError(res));
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
            Левая плашка на главной — карточки категории «Карточка на заказ» с
            эффектом Vario, как в каталоге. Обычная картинка без варио сюда не
            ставится. Кнопка заказа пока «(в разработке)».
          </p>
        </div>
        <AdminCustomOrderCardsEditor />
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <PromoUrlField
            label="URL кнопки «Примеры»"
            placeholder="/card/id или https://…"
            value={custom.href}
            hint="Необязательно. Пустая ссылка скрывает кнопку «Примеры» на главной."
            onChange={(href) => setCustom({ href })}
          />
          <div className="mt-4">
            <SaveButton saving={saving} onClick={() => void save()} />
          </div>
        </div>
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
