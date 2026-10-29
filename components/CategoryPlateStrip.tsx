"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ProductCardNavArrowIcon } from "@/app/components/card-showcase/CardViewer";
import {
  useCategoryPlateHighlight,
  useCategoryTiles,
} from "@/app/context/CategoryFramesContext";
import {
  withCustomOrderCategoryFirst,
  type CategoryTile,
} from "@/app/lib/categoriesJson";
import { collectionSlugFromPath } from "@/app/lib/catalogCategoryPlatesNav";
import {
  collectionPath,
  findCategoryNameBySlug,
} from "@/app/lib/collectionAnchor";
import { categoryFocusToStyle } from "@/app/lib/imageFocus";

type Props = {
  activeCategoryName?: string | null;
};

function plateOf(cat: CategoryTile): {
  src: string;
  focus: CategoryTile["plateImageFocus"] | CategoryTile["imageFocus"];
} {
  const src = (cat.plateImage?.trim() || cat.image || "").trim();
  const focus = cat.plateImage?.trim() ? cat.plateImageFocus : cat.imageFocus;
  return { src, focus };
}

export function CategoryPlateStrip({ activeCategoryName }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { highlightCategory } = useCategoryPlateHighlight();
  const tiles = useCategoryTiles();
  const categories = useMemo(
    () => withCustomOrderCategoryFirst(tiles).filter((c) => c.name.trim()),
    [tiles],
  );
  const names = useMemo(
    () => categories.map((c) => c.name.trim()),
    [categories],
  );
  const stripRef = useRef<HTMLDivElement>(null);
  const [canScrollStart, setCanScrollStart] = useState(false);
  const [canScrollEnd, setCanScrollEnd] = useState(true);
  const active = useMemo(() => {
    const explicit = (activeCategoryName ?? "").trim();
    if (explicit) return explicit;
    const slug = collectionSlugFromPath(pathname);
    if (slug) return findCategoryNameBySlug(slug, names)?.trim() ?? "";
    if (pathname.startsWith("/card/")) return highlightCategory.trim();
    return "";
  }, [activeCategoryName, highlightCategory, names, pathname]);

  const updateScroll = useCallback(() => {
    const el = stripRef.current;
    if (!el) {
      setCanScrollStart(false);
      setCanScrollEnd(false);
      return;
    }
    const max = el.scrollWidth - el.clientWidth;
    const overflow = max > 6;
    setCanScrollStart(overflow && el.scrollLeft > 4);
    setCanScrollEnd(overflow && el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const run = () => updateScroll();
    run();
    const raf = requestAnimationFrame(run);
    el.addEventListener("scroll", run, { passive: true });
    const ro = new ResizeObserver(run);
    ro.observe(el);
    window.addEventListener("resize", run);
    const imgs = el.querySelectorAll("img");
    const onImg = () => run();
    imgs.forEach((img) => {
      if (!img.complete) img.addEventListener("load", onImg);
    });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", run);
      ro.disconnect();
      window.removeEventListener("resize", run);
      imgs.forEach((img) => img.removeEventListener("load", onImg));
    };
  }, [updateScroll, categories.length]);

  useEffect(() => {
    const el = stripRef.current;
    if (!el || !active) return;
    const current = el.querySelector<HTMLElement>("[aria-current='true']");
    current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "auto",
    });
    updateScroll();
  }, [active, categories.length, updateScroll]);

  const scrollByPage = useCallback(
    (direction: -1 | 1) => {
      const el = stripRef.current;
      if (!el) return;
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      if (max <= 0) {
        updateScroll();
        return;
      }
      const step = Math.max(el.clientWidth * 0.72, 72);
      el.scrollLeft = Math.min(max, Math.max(0, el.scrollLeft + direction * step));
      updateScroll();
    },
    [updateScroll],
  );

  if (categories.length === 0) return null;

  return (
    <div
      className={[
        "categories hero-categories-outer hero-categories-row site-category-plates-row relative w-full min-w-0",
        canScrollStart ? "is-cat-scrolled" : "",
        canScrollEnd ? "can-cat-scroll-end" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="hero-cat-scroll-btn hero-cat-scroll-btn--prev"
        aria-label="Предыдущие категории"
        disabled={!canScrollStart}
        onClick={() => scrollByPage(-1)}
      >
        <ProductCardNavArrowIcon direction="prev" />
      </button>
      <div
        ref={stripRef}
        className="hero-categories hero-categories-strip relative flex min-w-0 w-full justify-start overflow-x-auto overflow-y-hidden py-0 scrollbar-hide md:py-0"
      >
        {categories.map((cat, catIndex) => {
          const selected = active.length > 0 && cat.name.trim() === active;
          const { src, focus } = plateOf(cat);
          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => router.push(collectionPath(cat.name))}
              aria-label={cat.name}
              aria-current={selected ? true : undefined}
              className={[
                "category-item group shrink-0 cursor-pointer overflow-hidden rounded-2xl",
                "will-change-transform [transform:translateZ(0)]",
                "transition-transform duration-300 ease-out",
                "hover:scale-[1.08] active:scale-[1.04]",
                "hover:shadow-xl hover:shadow-zinc-500/25",
                selected ? "ring-2 ring-purple-400/90" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {src ? (
                <div className="category-tile-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    className="category-tile-img h-full w-full max-h-full max-w-full rounded-[inherit] object-cover"
                    style={categoryFocusToStyle(focus)}
                    draggable={false}
                    loading={catIndex < 4 ? "eager" : "lazy"}
                    decoding="async"
                  />
                </div>
              ) : (
                <div
                  className="category-tile-wrap rounded-[inherit] bg-zinc-800"
                  aria-hidden
                />
              )}
              <div className="hero-category-label z-10 text-center leading-tight">
                {cat.name}
              </div>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="hero-cat-scroll-btn hero-cat-scroll-btn--next"
        aria-label="Следующие категории"
        disabled={!canScrollEnd}
        onClick={() => scrollByPage(1)}
      >
        <ProductCardNavArrowIcon direction="next" />
      </button>
    </div>
  );
}
