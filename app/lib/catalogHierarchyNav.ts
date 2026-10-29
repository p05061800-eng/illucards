/** Иерархия витрины: главная → /collection → /collection/[slug] → /card/[id]. */

const STACK_KEY = "illucards:catalog-hierarchy-stack";

export function catalogPathname(path: string): string {
  const p = path.trim();
  if (!p) return "/";
  const noQuery = p.split("?")[0] ?? p;
  const noHash = noQuery.split("#")[0] ?? noQuery;
  if (noHash.length > 1 && noHash.endsWith("/")) return noHash.slice(0, -1);
  return noHash || "/";
}

export function isCatalogHierarchyPath(pathname: string): boolean {
  const p = catalogPathname(pathname);
  return (
    p === "/" ||
    p === "/collection" ||
    p.startsWith("/collection/") ||
    p.startsWith("/card/")
  );
}

export function isCollectionIndexPath(pathname: string): boolean {
  return catalogPathname(pathname) === "/collection";
}

export function isCollectionSlugPath(pathname: string): boolean {
  const p = catalogPathname(pathname);
  return p.startsWith("/collection/") && p.length > "/collection/".length;
}

export function isCardPath(pathname: string): boolean {
  return catalogPathname(pathname).startsWith("/card/");
}

function catalogDepth(pathname: string): number {
  const p = catalogPathname(pathname);
  if (p === "/") return 0;
  if (p === "/collection") return 1;
  if (p.startsWith("/collection/")) return 2;
  if (p.startsWith("/card/")) return 3;
  return -1;
}

export function readCatalogHierarchyStack(): string[] {
  try {
    const raw = sessionStorage.getItem(STACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .map(catalogPathname);
  } catch {
    return [];
  }
}

function writeCatalogHierarchyStack(stack: string[]): void {
  try {
    sessionStorage.setItem(STACK_KEY, JSON.stringify(stack));
  } catch {
    /* private mode */
  }
}

/**
 * Синхронизация стека с текущим URL. Не вызывает router.push —
 * только sessionStorage, чтобы in-app «Назад» знало родителя.
 */
export function syncCatalogHierarchyStack(pathname: string): void {
  if (typeof window === "undefined") return;
  if (!isCatalogHierarchyPath(pathname)) return;
  const here = catalogPathname(pathname);
  const stack = readCatalogHierarchyStack();
  const last = stack[stack.length - 1];
  if (last === here) return;

  const idx = stack.lastIndexOf(here);
  if (idx >= 0) {
    writeCatalogHierarchyStack(stack.slice(0, idx + 1));
    return;
  }

  const lastDepth = last ? catalogDepth(last) : -1;
  const nextDepth = catalogDepth(here);
  if (last && nextDepth === lastDepth && nextDepth >= 2) {
    writeCatalogHierarchyStack([...stack.slice(0, -1), here]);
    return;
  }
  if (last && nextDepth > lastDepth) {
    writeCatalogHierarchyStack([...stack, here]);
    return;
  }
  writeCatalogHierarchyStack([here]);
}

export function peekCatalogHierarchyParent(): string | null {
  const stack = readCatalogHierarchyStack();
  if (stack.length < 2) return null;
  return stack[stack.length - 2] ?? null;
}

export function acceptCardBackParent(parent: string): boolean {
  return isCollectionSlugPath(parent) || parent === "/";
}

export function acceptCollectionBackParent(parent: string): boolean {
  return isCollectionIndexPath(parent) || parent === "/";
}

export function acceptCategoryIndexBackParent(parent: string): boolean {
  return parent === "/";
}
