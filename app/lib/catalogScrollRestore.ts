const STORAGE_KEY = "illucards-catalog-return-card";
const SCROLL_PREFIX = "illucards:scroll:";

/** Сохранить текущую позицию скролла перед переходом (чтобы «Назад» не сбрасывал вверх). */
export function saveCurrentScrollPosition(): void {
  try {
    if (typeof window === "undefined") return;
    const key =
      window.location.pathname +
      (window.location.search ? window.location.search : "");
    sessionStorage.setItem(SCROLL_PREFIX + key, String(Math.round(window.scrollY)));
  } catch {
    /* storage disabled / private mode */
  }
}

/** Стабильный DOM id для якоря карточки в каталоге (UUID в id безопасен). */
export function catalogCardAnchorId(cardId: string): string {
  return `catalog-card-${cardId}`;
}

export function rememberCatalogReturnCardId(cardId: string): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(STORAGE_KEY, cardId);
    if (typeof window !== "undefined" && window.location.pathname === "/") {
      saveCurrentScrollPosition();
    }
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
