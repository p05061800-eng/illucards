const STORAGE_KEY = "illucards-catalog-return-card";

/** Стабильный DOM id для якоря карточки в каталоге (UUID в id безопасен). */
export function catalogCardAnchorId(cardId: string): string {
  return `catalog-card-${cardId}`;
}

export function rememberCatalogReturnCardId(cardId: string): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(STORAGE_KEY, cardId);
  } catch {
    /* storage disabled / private mode */
  }
}

export function peekCatalogReturnCardId(): string | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const v = sessionStorage.getItem(STORAGE_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function clearCatalogReturnCardId(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function parseCatalogCardIdFromHash(hash: string): string | null {
  if (!hash.startsWith("#")) return null;
  const body = hash.slice(1);
  const prefix = "catalog-card-";
  if (!body.startsWith(prefix)) return null;
  const id = body.slice(prefix.length);
  return id.length > 0 ? id : null;
}
