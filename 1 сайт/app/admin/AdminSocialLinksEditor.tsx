"use client";

import { useCallback, useEffect, useState } from "react";
import type { SocialLinksConfig, SocialNetworkId } from "@/app/lib/socialLinksJson";
import { DEFAULT_SOCIAL_LINKS_CONFIG } from "@/app/lib/socialLinksJson";
import {
  SOCIAL_NETWORK_LABELS,
  SOCIAL_NETWORK_ORDER,
} from "@/app/lib/socialLinksJson";
import { apiUrl } from "@/app/lib/apiUrl";

export function AdminSocialLinksEditor() {
  const [config, setConfig] = useState<SocialLinksConfig>(
    DEFAULT_SOCIAL_LINKS_CONFIG
  );
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/social-links"))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: unknown) => {
        if (cancelled || !data || typeof data !== "object") return;
        if ("links" in data && typeof (data as { links: unknown }).links === "object") {
          setConfig(data as SocialLinksConfig);
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

  const setUrl = useCallback((id: SocialNetworkId, value: string) => {
    setConfig((prev) => ({
      links: { ...prev.links, [id]: value },
    }));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/social-links"), {
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

  if (!loaded) {
    return (
      <p className="text-sm text-zinc-500">Загрузка…</p>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-zinc-400">
        Укажите полные ссылки (с https://). Пустое поле — кубик на главной не
        показывается.
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        {SOCIAL_NETWORK_ORDER.map((id) => (
          <label
            key={id}
            className="block rounded-xl border border-white/10 bg-white/[0.03] p-4"
          >
            <span className="mb-2 block text-sm font-semibold text-zinc-200">
              {SOCIAL_NETWORK_LABELS[id]}
            </span>
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://…"
              value={config.links[id] ?? ""}
              onChange={(e) => setUrl(id, e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full border border-violet-500/40 bg-violet-950/50 px-6 py-2.5 text-sm font-semibold text-violet-100 transition hover:border-violet-400/60 hover:bg-violet-900/60 disabled:opacity-50"
        >
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
