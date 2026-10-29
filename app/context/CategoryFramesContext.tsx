"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiUrl } from "@/app/lib/apiUrl";
import {
  parseCategoriesJson,
  mergeCategoryTiles,
  categoryFrameAspectCssFromTiles,
  type CategoryTile,
} from "@/app/lib/categoriesJson";
import fallbackJson from "@/data/categories.json";

const STATIC_TILES: CategoryTile[] = parseCategoriesJson(fallbackJson);

type Ctx = {
  tiles: CategoryTile[];
  refreshTiles: () => void;
  highlightCategory: string;
  setHighlightCategory: (name: string) => void;
};

const CategoryFramesContext = createContext<Ctx | null>(null);

const noopRefresh = () => {};
const noopHighlight = (_name: string) => {};

export function CategoryFramesProvider({ children }: { children: ReactNode }) {
  const [tiles, setTiles] = useState<CategoryTile[]>(STATIC_TILES);
  const [highlightCategory, setHighlightCategory] = useState("");

  const refreshTiles = useCallback(() => {
    fetch(apiUrl("/api/categories"))
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;
        setTiles(mergeCategoryTiles(STATIC_TILES, parseCategoriesJson(data)));
      })
      .catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ tiles, refreshTiles, highlightCategory, setHighlightCategory }),
    [tiles, refreshTiles, highlightCategory],
  );
  return (
    <CategoryFramesContext.Provider value={value}>
      {children}
    </CategoryFramesContext.Provider>
  );
}

/** После сохранения категорий в админке — обновить рамки витрины на всех клиентских экранах. */
export function useCategoryFramesRefresh(): () => void {
  const ctx = useContext(CategoryFramesContext);
  return ctx?.refreshTiles ?? noopRefresh;
}

export function useCategoryTiles(): CategoryTile[] {
  const ctx = useContext(CategoryFramesContext);
  return ctx?.tiles ?? STATIC_TILES;
}

export function useCategoryPlateHighlight(): {
  highlightCategory: string;
  setHighlightCategory: (name: string) => void;
} {
  const ctx = useContext(CategoryFramesContext);
  return {
    highlightCategory: ctx?.highlightCategory ?? "",
    setHighlightCategory: ctx?.setHighlightCategory ?? noopHighlight,
  };
}

export function useCategoryFrameAspectCss(
  categoryName: string | undefined,
): string | undefined {
  const tiles = useCategoryTiles();
  return useMemo(
    () => categoryFrameAspectCssFromTiles(tiles, categoryName),
    [tiles, categoryName],
  );
}
