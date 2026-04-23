import type { StoredCard } from "@/app/api/cards/route";

export type VoteEntry = { sum: number; count: number };

/**
 * Средняя оценка: база из карточки (по умолчанию 5) + голоса посетителей из card-votes.json.
 */
export function mergeCardRating(
  card: Pick<StoredCard, "ratingAvg" | "reviewCount">,
  visitorVotes?: VoteEntry | null
): { avg: number; totalCount: number } {
  const adminAvg = (() => {
    const r = Number(card.ratingAvg);
    return Number.isFinite(r) ? Math.min(5, Math.max(0, r)) : 5;
  })();
  const adminCount = Math.max(0, Math.floor(card.reviewCount ?? 0));
  const vSum = visitorVotes?.sum ?? 0;
  const vCount = visitorVotes?.count ?? 0;

  if (vCount === 0 && adminCount === 0) {
    return { avg: adminAvg, totalCount: 0 };
  }

  const totalStars = adminAvg * adminCount + vSum;
  const totalVotes = adminCount + vCount;
  const avg =
    totalVotes > 0
      ? Math.min(5, Math.round((totalStars / totalVotes) * 10) / 10)
      : adminAvg;
  return { avg, totalCount: totalVotes };
}
