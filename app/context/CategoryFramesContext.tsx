"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiUrl } from "@/app/lib/apiUrl";
import {
  parseCategoriesJson,
  categoryFrameAspectCssFromTiles,
  type CategoryTile,
} from "@/app/lib/categoriesJson";
import fallbackJson from "@/data/categories.json";

const STATIC_TILES: CategoryTile[] = parseCategoriesJson(fallbackJson);

type Ctx = {
  tiles: CategoryTile[];
  refreshTiles: () => void;
};

const CategoryFramesContext = createContext<Ctx | null>(null);

const noopRefresh = () => {};

export function CategoryFramesProvider({ children }: { children: ReactNode }) {
  const [tiles, setTiles] = useState<CategoryTile[]>(STATIC_TILES);

  const refreshTiles = useCallback(() => {
    fetch(apiUrl("/api/categories"))
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;
        setTiles(parseCategoriesJson(data));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshTiles();
  }, [refreshTiles]);

  const value = useMemo(
    () => ({ tiles, refreshTiles }),
    [tiles, refreshTiles],
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

export function useCategoryFrameAspectCss(
  categoryName: string | undefined,
): string | undefined {
  const tiles = useCategoryTiles();
  return useMemo(
    () => categoryFrameAspectCssFromTiles(tiles, categoryName),
    [tiles, categoryName],
  );
}
