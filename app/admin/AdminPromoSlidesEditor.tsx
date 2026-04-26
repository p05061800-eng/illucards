"use client";

import { useCallback, useEffect, useState } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import type { PromoSlide } from "@/app/lib/promoSlidesJson";
import { apiUrl } from "@/app/lib/apiUrl";

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `promo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function AdminPromoSlidesEditor() {
  const [items, setItems] = useState<PromoSlide[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/promo-slides"))
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: unknown) => {
        if (cancelled || !data || typeof data !== "object") return;
        const raw = (data as { items?: unknown }).items;
        if (!Array.isArray(raw)) return;
        const next: PromoSlide[] = [];
        for (const x of raw) {
          if (!x || typeof x !== "object") continue;
          const o = x as Record<string, unknown>;
          if (typeof o.id !== "string" || typeof o.imageUrl !== "string") continue;
          next.push({
            id: o.id,
            imageUrl: o.imageUrl,
            href: typeof o.href === "string" ? o.href : "",
          });
        }
        setItems(next);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const addSlide = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { id: newId(), imageUrl: "", href: "" },
    ]);
  }, []);

  const removeSlide = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const move = useCallback((id: string, dir: -1 | 1) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.id === id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      const t = copy[i]!;
      copy[i] = copy[j]!;
      copy[j] = t;
      return copy;
    });
  }, []);

  const setHref = useCallback((id: string, href: string) => {
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, href } : x))
    );
  }, []);

  const uploadFor = useCallback(async (id: string, file: File | null) => {
    if (!file) return;
    setUploadingId(id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", "promo");
      const res = await fetch(apiUrl("/api/upload"), { method: "POST", body: fd });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        window.alert(
          typeof data.error === "string" ? data.error : "Не удалось загрузить файл."
        );
        return;
      }
      setItems((prev) =>
        prev.map((x) => (x.id === id ? { ...x, imageUrl: data.url! } : x))
      );
    } catch {
      window.alert("Ошибка сети при загрузке.");
    } finally {
      setUploadingId(null);
    }
  }, []);

  const save = async () => {
    if (items.some((x) => !x.imageUrl.trim())) {
      window.alert(
        "У каждой добавленной акции должна быть картинка — загрузите файл или удалите строку."
      );
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/promo-slides"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
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

  if (!loaded) {
    return <p className="text-sm text-zinc-500">Загрузка…</p>;
  }

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40";

  return (
    <div className="space-y-8">
      <p className="text-sm text-zinc-400">
        Баннеры в герое под плашками категорий: соотношение сторон{" "}
        <span className="font-semibold text-zinc-200">16:9</span> (как 1024×576).
        Рекомендуется заранее сверстать текст на картинке. Ссылка необязательна:
        можно указать <code className="text-violet-300/90">/card/…</code>,{" "}
        <code className="text-violet-300/90">#collection</code> или внешний URL.
      </p>

      {items.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-zinc-500">
          Пока нет акций. Нажмите «Добавить акцию», загрузите баннер 16:9 и сохраните.
        </p>
      ) : null}

      <div className="space-y-4">
        {items.map((row, idx) => (
          <div
            key={row.id}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-300/80">
                <GripVertical className="h-4 w-4 text-zinc-500" aria-hidden />
                Акция {idx + 1}
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => move(row.id, -1)}
                  className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-violet-400/40 hover:text-white disabled:opacity-30"
                >
                  Вверх
                </button>
                <button
                  type="button"
                  disabled={idx >= items.length - 1}
                  onClick={() => move(row.id, 1)}
                  className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-violet-400/40 hover:text-white disabled:opacity-30"
                >
                  Вниз
                </button>
                <button
                  type="button"
                  onClick={() => removeSlide(row.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/25 bg-red-950/30 px-2.5 py-1 text-xs text-red-200 transition hover:border-red-400/50 hover:bg-red-900/40"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Удалить
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,220px)_1fr] md:items-start">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-400">
                  Картинка (16:9)
                </label>
                {row.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.imageUrl}
                    alt=""
                    className="aspect-video w-full rounded-lg border border-white/10 object-cover"
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/40 text-xs text-zinc-500">
                    Нет файла
                  </div>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploadingId === row.id}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    void uploadFor(row.id, f);
                  }}
                  className="block w-full max-w-full text-xs text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-violet-500"
                />
                {uploadingId === row.id ? (
                  <p className="text-xs text-violet-300/90">Загрузка…</p>
                ) : null}
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Ссылка при клике (необязательно)
                </span>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="/card/id или https://…"
                  value={row.href}
                  onChange={(e) => setHref(row.id, e.target.value)}
                  autoComplete="off"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={addSlide}
          className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-violet-400/40 hover:bg-white/10 hover:text-white"
        >
          + Добавить акцию
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full border border-violet-500/40 bg-violet-950/50 px-6 py-2.5 text-sm font-semibold text-violet-100 transition hover:border-violet-400/60 hover:bg-violet-900/60 disabled:opacity-40"
        >
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
