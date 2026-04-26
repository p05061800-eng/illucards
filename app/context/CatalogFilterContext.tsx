"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  EMPTY_TYPE_FILTER,
  type PriceSort,
  type TypeFilterState,
} from "@/app/lib/collectionFilter";

type CatalogFilterContextValue = {
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  categoryFilter: string;
  setCategoryFilter: Dispatch<SetStateAction<string>>;
  typeFilter: TypeFilterState;
  setTypeFilter: Dispatch<SetStateAction<TypeFilterState>>;
  toggleType: (key: keyof TypeFilterState) => void;
  priceSort: PriceSort;
  setPriceSort: Dispatch<SetStateAction<PriceSort>>;
  filtersOpen: boolean;
  setFiltersOpen: Dispatch<SetStateAction<boolean>>;
  /** Прокрутить к блоку «Коллекции» на главной или перейти на `/#collection` — без открытия панели фильтров */
  scrollToCollection: () => void;
  /** Открыть панель фильтров и прокрутить к блоку «Коллекции» */
  openFiltersAndScrollToCollection: () => void;
  resetFilters: () => void;
};

const CatalogFilterContext = createContext<CatalogFilterContextValue | null>(
  null
);

export function CatalogFilterProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] =
    useState<TypeFilterState>(EMPTY_TYPE_FILTER);
  const [priceSort, setPriceSort] = useState<PriceSort>("default");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const toggleType = useCallback((key: keyof TypeFilterState) => {
    setTypeFilter((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const resetFilters = useCallback(() => {
    setSearch("");
    setCategoryFilter("");
    setTypeFilter(EMPTY_TYPE_FILTER);
    setPriceSort("default");
  }, []);

  /** На странице карточки поиск в шапке не должен держать запрос с главной — иначе при возврате срабатывает автопереход. */
  useEffect(() => {
    if (pathname.startsWith("/card/")) {
      setSearch("");
    }
  }, [pathname, setSearch]);

  const scrollToCollection = useCallback(() => {
    if (pathname === "/") {
      requestAnimationFrame(() => {
        document
          .getElementById("collection")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } else {
      router.push("/#collection");
    }
  }, [pathname, router]);

  const openFiltersAndScrollToCollection = useCallback(() => {
    setFiltersOpen(true);
    scrollToCollection();
  }, [scrollToCollection]);

  const value = useMemo(
    () => ({
      search,
      setSearch,
      categoryFilter,
      setCategoryFilter,
      typeFilter,
      setTypeFilter,
      toggleType,
      priceSort,
      setPriceSort,
      filtersOpen,
      setFiltersOpen,
      scrollToCollection,
      openFiltersAndScrollToCollection,
      resetFilters,
    }),
    [
      search,
      categoryFilter,
      typeFilter,
      priceSort,
      filtersOpen,
      toggleType,
      resetFilters,
      scrollToCollection,
      openFiltersAndScrollToCollection,
    ]
  );

  return (
    <CatalogFilterContext.Provider value={value}>
      {children}
    </CatalogFilterContext.Provider>
  );
}

export function useCatalogFilter(): CatalogFilterContextValue {
  const ctx = useContext(CatalogFilterContext);
  if (!ctx) {
    throw new Error("useCatalogFilter must be used within CatalogFilterProvider");
  }
  return ctx;
}
