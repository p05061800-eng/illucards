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
import type { StoredCard } from "@/app/api/cards/route";
import { apiUrl } from "@/app/lib/apiUrl";
import { mergeCardRating, type VoteEntry } from "@/app/lib/mergeCardRating";

type Ctx = {
  votes: Record<string, VoteEntry>;
  hydrated: boolean;
  refresh: () => Promise<void>;
  submitVote: (cardId: string, stars: number) => Promise<{ ok: boolean }>;
  mergedFor: (card: StoredCard) => { avg: number; totalCount: number };
};

const CardRatingsContext = createContext<Ctx | null>(null);

export function CardRatingsProvider({ children }: { children: ReactNode }) {
  const [votes, setVotes] = useState<Record<string, VoteEntry>>({});
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/card-ratings"));
      const data = (await res.json()) as { votes?: Record<string, VoteEntry> };
      if (data.votes && typeof data.votes === "object") {
        setVotes(data.votes);
      }
    } catch {
      /* ignore */
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submitVote = useCallback(
    async (cardId: string, stars: number) => {
      const res = await fetch(apiUrl("/api/card-ratings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, stars }),
      });
      if (!res.ok) return { ok: false };
      await refresh();
      try {
        localStorage.setItem(`illucards_rated_${cardId}`, String(stars));
      } catch {
        /* ignore */
      }
      return { ok: true };
    },
    [refresh]
  );

  const mergedFor = useCallback(
    (card: StoredCard) => mergeCardRating(card, votes[card.id] ?? null),
    [votes]
  );

  const value = useMemo(
    () => ({
      votes,
      hydrated,
      refresh,
      submitVote,
      mergedFor,
    }),
    [votes, hydrated, refresh, submitVote, mergedFor]
  );

  return (
    <CardRatingsContext.Provider value={value}>
      {children}
    </CardRatingsContext.Provider>
  );
}

export function useCardRatings() {
  const ctx = useContext(CardRatingsContext);
  if (!ctx) {
    throw new Error("useCardRatings вне CardRatingsProvider");
  }
  return ctx;
}

export function useMergedRating(card: StoredCard) {
  const { mergedFor } = useCardRatings();
  return useMemo(() => mergedFor(card), [card, mergedFor]);
}
