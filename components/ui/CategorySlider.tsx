"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { categories } from "@/data/categories";

type NavigateProps = {
  behavior: "navigate";
  activeCategoryName: string | null;
  showAll?: boolean;
};

type CallbackProps = {
  behavior: "callback";
  activeCategoryName: string | null;
  showAll?: boolean;
  onSelect: (name: string | null) => void;
};

export type CategorySliderProps = NavigateProps | CallbackProps;

export default function CategorySlider(props: CategorySliderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { activeCategoryName, showAll = false, behavior } = props;

  const scroll = (dir: "left" | "right") => {
    ref.current?.scrollBy({
      left: dir === "left" ? -300 : 300,
      behavior: "smooth",
    });
  };

  const goCategory = (name: string) => {
    if (behavior === "callback") {
      props.onSelect(name);
    } else {
      router.push("/#collection");
    }
  };

  const goAll = () => {
    if (behavior === "callback") {
      props.onSelect(null);
    } else {
      router.push("/");
    }
  };

  const allActive = showAll && activeCategoryName === null;

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => scroll("left")}
        className="absolute left-0 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-white backdrop-blur-md transition hover:bg-black/70"
        aria-label="Прокрутить категории влево"
      >
        ←
      </button>

      <div
        ref={ref}
        className="scrollbar-hide flex gap-4 overflow-x-auto px-6 py-2"
      >
        {showAll ? (
          <button
            key="all"
            type="button"
            onClick={goAll}
            aria-label="Все категории"
            className={[
              "group relative z-0 h-[80px] min-w-[80px] shrink-0 cursor-pointer overflow-hidden rounded-xl",
              "will-change-transform [transform:translateZ(0)]",
              "transition-transform duration-300 ease-out",
              "hover:scale-[1.15] active:scale-[1.08] hover:z-20",
              "hover:shadow-xl hover:shadow-purple-500/35 hover:brightness-110",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
              allActive
                ? "z-10 ring-2 ring-purple-400/90"
                : "hover:ring-2 hover:ring-purple-400/35",
            ].join(" ")}
          >
            <div
              className="absolute inset-0 bg-gradient-to-br from-zinc-600 via-zinc-900 to-black transition duration-300"
              aria-hidden
            />
            <div className="pointer-events-none absolute inset-0 bg-black/30 transition duration-300 group-hover:bg-black/10" />
            <div
              className="pointer-events-none absolute inset-0 opacity-0 shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-opacity duration-300 ease-out group-hover:opacity-100"
              aria-hidden
            />
            {allActive ? (
              <div
                className="pointer-events-none absolute inset-0 shadow-[0_0_40px_rgba(168,85,247,0.9)]"
                aria-hidden
              />
            ) : null}
            {allActive ? (
              <div
                className="pointer-events-none absolute inset-0 rounded-xl border border-purple-400"
                aria-hidden
              />
            ) : null}
          </button>
        ) : null}

        {categories.map((cat) => {
          const active = activeCategoryName === cat.name;
          return (
            <button
              key={cat.slug}
              type="button"
              onClick={() => goCategory(cat.name)}
              aria-label={cat.name}
              className={[
                "group relative z-0 h-[80px] min-w-[80px] shrink-0 cursor-pointer overflow-hidden rounded-xl bg-zinc-950",
                "will-change-transform [transform:translateZ(0)]",
                "transition-transform duration-300 ease-out",
                "hover:scale-[1.15] active:scale-[1.08] hover:z-20",
                "hover:shadow-xl hover:shadow-purple-500/35 hover:brightness-110",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                active
                  ? "z-10 ring-2 ring-purple-400/90"
                  : "hover:ring-2 hover:ring-purple-400/35",
              ].join(" ")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cat.image}
                alt=""
                className="category-tile-img h-full w-full rounded-xl object-contain"
                draggable={false}
              />

              <div className="pointer-events-none absolute inset-0 bg-black/30 transition duration-300 ease-out group-hover:bg-black/10" />

              <div
                className="pointer-events-none absolute inset-0 opacity-0 shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-opacity duration-300 ease-out group-hover:opacity-100"
                aria-hidden
              />

              {active ? (
                <div
                  className="pointer-events-none absolute inset-0 shadow-[0_0_40px_rgba(168,85,247,0.9)]"
                  aria-hidden
                />
              ) : null}

              {active ? (
                <div
                  className="pointer-events-none absolute inset-0 rounded-xl border border-purple-400"
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => scroll("right")}
        className="absolute right-0 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-white backdrop-blur-md transition hover:bg-black/70"
        aria-label="Прокрутить категории вправо"
      >
        →
      </button>
    </div>
  );
}
