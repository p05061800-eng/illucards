"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { syncCatalogHierarchyStack } from "@/app/lib/catalogHierarchyNav";

/** Держит стек иерархии витрины в sessionStorage при переходах и popstate. */
export function CatalogNavSync() {
  const pathname = usePathname();

  useEffect(() => {
    syncCatalogHierarchyStack(pathname);
  }, [pathname]);

  return null;
}
