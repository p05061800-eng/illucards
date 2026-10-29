"use client";

import { useMemo } from "react";
import type { CategoryTile } from "@/app/lib/categoriesJson";
import { categoryFocusToStyle } from "@/app/lib/imageFocus";

type Props = {
  tiles: readonly CategoryTile[];
  names: readonly string[];
  selected: string;
  onSelect: (name: string) => void;
};

function plateSrc(tile: CategoryTile | undefined): {
  src: string;
  focus: CategoryTile["plateImageFocus"] | CategoryTile["imageFocus"];
} {
  if (!tile) return { src: "", focus: undefined };
  const src = (tile.plateImage?.trim() || tile.image || "").trim();
  const focus = tile.plateImage?.trim() ? tile.plateImageFocus : tile.imageFocus;
  return { src, focus };
}

const plateBtn =
  "relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400";

export function FilterCategoryPlates({
  tiles,
  names,
  selected,
  onSelect,
}: Props) {
  const byName = useMemo(() => {
    const map = new Map<string, CategoryTile>();
    for (const tile of tiles) {
      const name = tile.name.trim();
      if (name) map.set(name, tile);
    }
    return map;
  }, [tiles]);

  const active = selected.trim();

  return (
    <div
      className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide"
      role="listbox"
      aria-label="Категория"
    >
      <button
        type="button"
        role="option"
        aria-selected={!active}
        aria-label="Все категории"
        title="Все категории"
        onClick={() => onSelect("")}
        className={`${plateBtn} ${
          !active
            ? "border-violet-400/80 bg-violet-500/20 ring-2 ring-violet-400/70"
            : "border-white/10 bg-zinc-900 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
        }`}
      >
        <span className="text-[10px] font-semibold leading-none">Все</span>
      </button>
      {names.map((name) => {
        const { src, focus } = plateSrc(byName.get(name));
        const on = active === name;
        return (
          <button
            key={name}
            type="button"
            role="option"
            aria-selected={on}
            aria-label={name}
            title={name}
            onClick={() => onSelect(name)}
            className={`${plateBtn} ${
              on
                ? "border-violet-400/80 ring-2 ring-violet-400/70"
                : "border-white/10 hover:border-white/30"
            }`}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                className="h-full w-full object-cover"
                style={categoryFocusToStyle(focus)}
                draggable={false}
              />
            ) : (
              <span className="px-0.5 text-[9px] font-semibold leading-tight text-zinc-300">
                {name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
