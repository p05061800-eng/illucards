"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DraggableImageFrame } from "@/app/admin/components/DraggableImageFrame";
import type { MenuJsonSection } from "@/app/lib/menuJson";
import { DEFAULT_CARD_ASPECT_RATIO_CSS } from "@/app/lib/cardAspectRatio";
import { DEFAULT_IMAGE_FOCUS } from "@/app/lib/imageFocus";
import { apiUrl } from "@/app/lib/apiUrl";

export default function AdminMenu() {
  const [menu, setMenu] = useState<MenuJsonSection[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/api/menu"))
      .then((res) => res.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setMenu(data as MenuJsonSection[]);
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const save = async () => {
    await fetch(apiUrl("/api/menu"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(menu),
    });
    window.alert("Сохранено");
  };

  const upload = useCallback(async (file: File, i: number, j: number) => {
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

    setMenu((prev) => {
      const next = structuredClone(prev);
      if (!next[i]?.items[j]) return prev;
      next[i].items[j].image = data.url!;
      next[i].items[j].imageFocus = DEFAULT_IMAGE_FOCUS;
      return next;
    });
  }, []);

  const removeSection = (i: number) => {
    if (!window.confirm("Удалить раздел и все пункты?")) return;
    setMenu((prev) => prev.filter((_, idx) => idx !== i));
  };

  const removeItem = (i: number, j: number) => {
    if (!window.confirm("Удалить пункт меню?")) return;
    setMenu((prev) => {
      const next = structuredClone(prev);
      next[i].items.splice(j, 1);
      return next;
    });
  };

  if (!loaded) {
    return (
      <div className="p-10 text-white">
        <p className="text-zinc-400">Загрузка…</p>
      </div>
    );
  }

  return (
    <div className="p-10 text-white">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link
          href="/admin"
          className="text-sm text-purple-400 hover:text-purple-300"
        >
          ← Админ
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">Меню</h1>

      {menu.map((section, i) => (
        <div
          key={`sec-${i}-${section.title}`}
          className="mb-10 rounded-xl border border-white/15 p-4"
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              value={section.title}
              onChange={(e) => {
                setMenu((prev) => {
                  const next = [...prev];
                  next[i] = { ...next[i], title: e.target.value };
                  return next;
                });
              }}
              className="flex-1 border border-white/20 bg-black p-2"
              placeholder="Заголовок раздела"
            />
            <button
              type="button"
              onClick={() => removeSection(i)}
              className="rounded bg-red-600/90 px-3 py-2 text-sm text-white hover:bg-red-500"
            >
              Удалить раздел
            </button>
          </div>

          {section.items.map((item, j) => (
            <div
              key={`item-${i}-${j}`}
              className="mb-4 flex flex-wrap items-end gap-3 border-b border-white/10 pb-4"
            >
              <div className="grid min-w-[200px] flex-1 gap-2 sm:grid-cols-2">
                <input
                  value={item.name}
                  placeholder="Название"
                  onChange={(e) => {
                    setMenu((prev) => {
                      const next = structuredClone(prev);
                      next[i].items[j].name = e.target.value;
                      return next;
                    });
                  }}
                  className="border border-white/20 bg-black p-2"
                />
                <input
                  value={item.link}
                  placeholder="Ссылка"
                  onChange={(e) => {
                    setMenu((prev) => {
                      const next = structuredClone(prev);
                      next[i].items[j].link = e.target.value;
                      return next;
                    });
                  }}
                  className="border border-white/20 bg-black p-2"
                />
              </div>

              <label className="flex cursor-pointer flex-col gap-1 text-xs text-zinc-400">
                Фото
                <input
                  type="file"
                  accept="image/*"
                  className="max-w-[200px] text-zinc-300"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file, i, j);
                    e.target.value = "";
                  }}
                />
              </label>

              <div className="w-[90px] shrink-0">
                {item.image ? (
                  <DraggableImageFrame
                    src={item.image}
                    value={item.imageFocus ?? DEFAULT_IMAGE_FOCUS}
                    onChange={(v) => {
                      setMenu((prev) => {
                        const next = structuredClone(prev);
                        if (!next[i]?.items[j]) return prev;
                        next[i].items[j].imageFocus = v;
                        return next;
                      });
                    }}
                    orientationFromImage
                  />
                ) : (
                  <div
                    className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-zinc-900 text-[10px] text-zinc-600"
                    style={{ aspectRatio: DEFAULT_CARD_ASPECT_RATIO_CSS }}
                  >
                    нет
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeItem(i, j)}
                className="rounded bg-zinc-800 px-3 py-2 text-sm text-red-400 hover:bg-zinc-700"
              >
                Удалить пункт
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              setMenu((prev) => {
                const next = structuredClone(prev);
                next[i].items.push({
                  name: "",
                  link: "",
                  image: "",
                  imageFocus: DEFAULT_IMAGE_FOCUS,
                });
                return next;
              });
            }}
            className="rounded bg-purple-500 px-3 py-1"
          >
            + пункт
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          setMenu((prev) => [...prev, { title: "Новый раздел", items: [] }])
        }
        className="mr-4 rounded bg-green-500 px-4 py-2"
      >
        + раздел
      </button>

      <button
        type="button"
        onClick={() => void save()}
        className="rounded bg-blue-500 px-4 py-2"
      >
        сохранить
      </button>
    </div>
  );
}
