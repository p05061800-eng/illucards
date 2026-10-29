"use client";

import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  acceptCardBackParent,
  acceptCategoryIndexBackParent,
  acceptCollectionBackParent,
  peekCatalogHierarchyParent,
} from "@/app/lib/catalogHierarchyNav";
import { useCatalogFilter } from "@/app/context/CatalogFilterContext";

type ParentKind = "home" | "categories" | "collection";

const BACK_PILL_CLASS =
  "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-violet-300/55 bg-zinc-950/95 px-3 py-1.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md transition hover:border-violet-200/80 hover:bg-zinc-900 sm:min-h-10 sm:px-4 sm:py-2";

const FILTER_PILL_CLASS =
  "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold shadow-[0_6px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md transition sm:min-h-10 sm:px-4 sm:py-2";

type Props = {
  href: string;
  className?: string;
  children?: ReactNode;
  parent: ParentKind;
  showFilter?: boolean;
};

function acceptFor(kind: ParentKind): (parentPath: string) => boolean {
  if (kind === "home") return acceptCategoryIndexBackParent;
  if (kind === "categories") return acceptCollectionBackParent;
  return acceptCardBackParent;
}

function isModifiedClick(e: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    e.button !== 0 ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey
  );
}

/**
 * «Назад» сверху слева (фильтр справа, если нужен), всегда на экране.
 * Портал в body — иначе overflow у main уносит кнопку при скролле.
 */
export function CatalogBackLink({
  href,
  parent: parentKind,
  showFilter = false,
}: Props) {
  const router = useRouter();
  const { filtersOpen, setFiltersOpen } = useCatalogFilter();
  const [mounted, setMounted] = useState(false);
  const [top, setTop] = useState(72);

  useEffect(() => {
    setMounted(true);
    const header = document.querySelector("header");
    if (!header) return;
    const sync = () => {
      const bottom = header.getBoundingClientRect().bottom;
      setTop(Math.max(4, Math.round(bottom + 4)));
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(header);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync);
    };
  }, []);

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isModifiedClick(e)) return;
    e.preventDefault();
    const parent = peekCatalogHierarchyParent();
    const acceptParent = acceptFor(parentKind);
    if (parent && acceptParent(parent) && parent !== window.location.pathname) {
      router.back();
      return;
    }
    router.replace(href);
  };

  const pill = (
    <Link
      href={href}
      aria-label="Назад"
      className={BACK_PILL_CLASS}
      onClick={onClick}
      prefetch
    >
      <span aria-hidden className="text-base leading-none">
        ←
      </span>
      Назад
    </Link>
  );

  const filterBtn = showFilter ? (
    <button
      type="button"
      onClick={() => setFiltersOpen((open) => !open)}
      aria-pressed={filtersOpen}
      className={`${FILTER_PILL_CLASS} ${
        filtersOpen
          ? "border-violet-400/60 bg-violet-950/90 text-violet-100"
          : "border-white/20 bg-zinc-950/95 text-zinc-100 hover:border-white/35 hover:bg-zinc-900"
      }`}
    >
      <SlidersHorizontal className="h-4 w-4 text-violet-300/80" aria-hidden />
      {filtersOpen ? "Свернуть" : "Фильтр"}
    </button>
  ) : null;

  return (
    <>
      <div className="mb-2 h-9 sm:mb-3 sm:h-10" aria-hidden />
      {mounted
        ? createPortal(
            <div
              className="pointer-events-none fixed inset-x-0 z-[180] flex items-center justify-between gap-3 px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-8"
              style={{ top }}
            >
              <div className="pointer-events-auto">{pill}</div>
              {filterBtn ? (
                <div className="pointer-events-auto">{filterBtn}</div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
