"use client";

/**
 * Избранное: id карточек — `localStorage` + синхронизация с `GET/POST /api/favorites`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { StoredCard } from "../api/cards/route";
import { apiUrl } from "../lib/apiUrl";
import { readTelegramPrimaryUserId } from "../lib/telegramUserIdentity";

export const FAVORITES_STORAGE_KEY = "illucards-favorites";

function loadIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function normalizeServerIds(data: unknown): string[] | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const ids = data.filter((x): x is string => typeof x === "string");
  return ids.length > 0 ? ids : null;
}

type FavoritesContextValue = {
  /** То же, что `favoriteIds` — для удобства в UI (счётчик: `favorites.length`) */
  favorites: string[];
  favoriteIds: string[];
  hydrated: boolean;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (card: StoredCard) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const userId = readTelegramPrimaryUserId();
    const favoritesUrl = userId == null
      ? apiUrl("/api/favorites")
      : apiUrl(`/api/favorites?user_id=${encodeURIComponent(String(userId))}`);
    fetch(favoritesUrl)
      .then((res) => res.json())
      .then((data: unknown) => {
        if (cancelled) return;
        const fromServer = normalizeServerIds(data);
        if (fromServer) {
          setFavoriteIds(fromServer);
        } else {
          setFavoriteIds(loadIds());
        }
        setHydrated(true);
      })
      .catch(() => {
        if (cancelled) return;
        setFavoriteIds(loadIds());
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIds));
    } catch {
      /* quota */
    }
  }, [favoriteIds, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const userId = readTelegramPrimaryUserId();
    void fetch(apiUrl("/api/favorites"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userId == null ? favoriteIds : {
        user_id: userId,
        favorites: favoriteIds,
      }),
    }).catch(() => {});
    if (userId == null) return;
    void fetch(apiUrl("/api/user-state"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        favorites: favoriteIds,
      }),
    }).catch(() => {});
  }, [favoriteIds, hydrated]);

  const isFavorite = useCallback(
    (id: string) => favoriteIds.includes(id),
    [favoriteIds]
  );

  const toggleFavorite = useCallback((card: StoredCard) => {
    const id = card.id;
    setFavoriteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const value = useMemo(
    () => ({
      favorites: favoriteIds,
      favoriteIds,
      hydrated,
      isFavorite,
      toggleFavorite,
    }),
    [favoriteIds, hydrated, isFavorite, toggleFavorite]
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error("useFavorites must be used within FavoritesProvider");
  }
  return ctx;
}
