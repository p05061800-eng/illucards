import type { StoredCard } from "@/app/api/cards/route";

const KEY = "illucards_product_preview_v1";

export function stashProductCard(card: StoredCard | null | undefined): void {
  if (!card?.id || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ t: Date.now(), card }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function readProductPreview(id: string): StoredCard | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t?: number; card?: StoredCard };
    if (parsed.card?.id !== id) return null;
    if (typeof parsed.t === "number" && Date.now() - parsed.t > 5 * 60_000) {
      return null;
    }
    return parsed.card;
  } catch {
    return null;
  }
}
