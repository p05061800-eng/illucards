"use client";

import Link from "next/link";
import {
  Menu,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { useCatalogFilter } from "@/app/context/CatalogFilterContext";
import { useCart } from "@/app/context/CartContext";
import { useCurrency } from "@/app/context/CurrencyContext";
import { useFavorites } from "@/app/context/FavoritesContext";
import { SocialLinksBar } from "@/app/components/SocialLinksBar";
import type { MenuJsonSection } from "@/app/lib/menuJson";
import { categoryFocusToStyle } from "@/app/lib/imageFocus";
import { apiUrl } from "@/app/lib/apiUrl";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState<MenuJsonSection[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { favorites, hydrated: favoritesHydrated } = useFavorites();
  const { hydrated: authHydrated, primaryTelegramUserId } = useAuth();
  const isTgLoggedIn = Boolean(
    authHydrated && primaryTelegramUserId != null,
  );
  const { itemCount, hydrated, cartOpen, openCart } = useCart();
  const count = hydrated ? itemCount : 0;
  const { currency, setCurrency } = useCurrency();
  const {
    search,
    setSearch,
    categoryFilter,
    typeFilter,
    priceSort,
    filtersOpen,
    setFiltersOpen,
    openFiltersAndScrollToCollection,
  } = useCatalogFilter();

  /** Первое нажатие — открыть фильтры у «Коллекций»; второе — закрыть и вернуться к началу главной. */
  const handleFilterButtonClick = useCallback(() => {
    if (filtersOpen) {
      setFiltersOpen(false);
      if (pathname === "/") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        router.push("/");
      }
    } else {
      openFiltersAndScrollToCollection();
    }
  }, [
    filtersOpen,
    setFiltersOpen,
    pathname,
    router,
    openFiltersAndScrollToCollection,
  ]);

  const catalogFiltersActive = useMemo(() => {
    const tf = typeFilter;
    return (
      search.trim() !== "" ||
      categoryFilter.trim() !== "" ||
      tf.adult ||
      tf.limited ||
      tf.common ||
      tf.replica ||
      tf.hotPrice ||
      tf.novelties ||
      priceSort !== "default"
    );
  }, [search, categoryFilter, typeFilter, priceSort]);

  useEffect(() => {
    fetch(apiUrl("/api/menu"))
      .then((res) => res.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setMenu(data as MenuJsonSection[]);
        }
      });
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-[200] border-b border-white/10 bg-[#070510]/90 text-white shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <div className="relative mx-auto flex max-w-[1400px] flex-col gap-3 px-2 py-3 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:gap-4 sm:px-6 sm:py-4 sm:pl-6 sm:pr-6 lg:px-10 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full min-w-0 flex-row items-center justify-between gap-2 md:w-auto md:flex-none md:flex-col md:items-start md:justify-start md:gap-0">
          <Link
            href="/"
            className="site-wordmark shrink-0 text-xl font-normal tracking-[0.05em]"
          >
            IlluCards
          </Link>
          <SocialLinksBar compact className="md:hidden" />
        </div>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-5 md:flex lg:gap-7">
          <SocialLinksBar compact />
          {menu.map((section) => (
            <div
              key={section.title}
              onMouseEnter={() => setActive(section.title)}
              onMouseLeave={() => setActive(null)}
              className="relative"
            >
              <p className="cursor-pointer whitespace-nowrap text-sm transition hover:text-purple-400">
                {section.title}
              </p>

              {active === section.title && section.items.length > 0 ? (
                <div className="absolute left-1/2 top-full z-50 pt-4">
                  <div
                    className="
                      flex -translate-x-1/2 gap-6 rounded-2xl border border-white/10
                      bg-black/95 p-6 backdrop-blur-xl
                    "
                  >
                    {section.items.map((item) => (
                      <Link
                        key={`${section.title}-${item.name}-${item.link}`}
                        href={item.link || "#"}
                        className="group block w-[140px] shrink-0"
                      >
                        <div className="w-full overflow-visible rounded-2xl bg-zinc-900/50">
                          {item.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.image}
                              alt=""
                              className="block h-auto w-full rounded-2xl transition duration-300 group-hover:brightness-110"
                              style={categoryFocusToStyle(item.imageFocus)}
                            />
                          ) : (
                            <div className="flex min-h-[120px] w-full items-center justify-center bg-zinc-800 text-xs text-zinc-500">
                              Нет фото
                            </div>
                          )}
                        </div>
                        <p className="mt-2 text-center text-sm text-white/70 transition group-hover:text-white">
                          {item.name || "—"}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </nav>

        <div className="flex w-full shrink-0 items-center justify-between gap-1.5 border-t border-white/[0.06] pt-3 sm:gap-3 md:w-auto md:justify-start md:border-t-0 md:pt-0">
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-zinc-200 transition hover:border-white/25 hover:bg-white/10 md:hidden"
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-nav-panel"
            aria-label={mobileNavOpen ? "Закрыть меню" : "Открыть меню"}
            onClick={() => setMobileNavOpen((o) => !o)}
          >
            {mobileNavOpen ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-1.5 md:flex-none md:gap-2">
            <div className="relative min-w-0 flex-1 max-w-[min(180px,100%)] sm:w-[200px] sm:max-w-none md:w-[260px] md:flex-none lg:w-[300px]">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск…"
                autoComplete="off"
                aria-label="Поиск по каталогу"
                className="w-full rounded-lg border border-white/10 bg-black/40 py-1.5 pl-8 pr-2 text-xs text-zinc-100 shadow-inner shadow-black/20 placeholder:text-zinc-600 focus:border-violet-400/45 focus:outline-none focus:ring-2 focus:ring-violet-500/20 sm:py-2 sm:text-[13px]"
              />
            </div>
            <button
              type="button"
              onClick={handleFilterButtonClick}
              aria-label={
                filtersOpen
                  ? "Закрыть фильтры и вернуться к началу страницы"
                  : "Открыть фильтры каталога"
              }
              title={filtersOpen ? "Закрыть фильтры" : "Фильтры"}
              aria-pressed={filtersOpen}
              className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-zinc-300 transition sm:h-10 sm:w-10 ${
                filtersOpen
                  ? "border-violet-400/50 bg-violet-500/15 text-violet-200"
                  : "border-white/10 bg-black/40 hover:border-violet-400/40 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden />
              {catalogFiltersActive ? (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-fuchsia-500 shadow-[0_0_8px_rgba(217,70,239,0.8)]" />
              ) : null}
            </button>
          </div>

          <div
            className="hidden rounded-full border border-white/12 bg-black/50 p-0.5 sm:flex"
            role="group"
            aria-label="Валюта"
          >
            <button
              type="button"
              onClick={() => setCurrency("BYN")}
              className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition sm:px-3 sm:text-xs ${
                currency === "BYN"
                  ? "bg-purple-600/90 text-white shadow-[0_0_14px_rgba(168,85,247,0.35)]"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              BYN
            </button>
            <button
              type="button"
              onClick={() => setCurrency("RUB")}
              className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition sm:px-3 sm:text-xs ${
                currency === "RUB"
                  ? "bg-purple-600/90 text-white shadow-[0_0_14px_rgba(168,85,247,0.35)]"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              RUB
            </button>
          </div>

          <Link
            href="/favorites"
            className="relative inline-flex text-xl transition duration-300 hover:opacity-90 active:opacity-80"
            aria-label="Избранное"
            title="Избранное"
          >
            ❤️
            {favoritesHydrated && favorites.length > 0 ? (
              <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-purple-600 px-1 text-[10px] font-bold tabular-nums leading-none text-white ring-2 ring-black">
                {favorites.length > 99 ? "99+" : favorites.length}
              </span>
            ) : null}
          </Link>

          <Link
            href={isTgLoggedIn ? "/account" : "/login"}
            className="inline-flex min-h-10 max-w-[min(11rem,32vw)] shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-2 py-1.5 text-left transition hover:border-white/25 hover:bg-white/10 sm:max-w-[14rem] sm:gap-2 sm:px-2.5"
            aria-label={
              isTgLoggedIn
                ? "Вы вошли — личный кабинет"
                : "Войти через Telegram"
            }
            title={isTgLoggedIn ? "Личный кабинет" : "Войти через Telegram"}
          >
            <User
              className="h-[18px] w-[18px] shrink-0 text-zinc-200"
              aria-hidden
            />
            <span className="min-w-0 flex-1 text-[10px] font-medium leading-tight sm:text-xs">
              {isTgLoggedIn ? (
                <span className="block sm:inline">
                  <span className="text-emerald-400/95">Вы вошли</span>
                  <span className="text-zinc-500 sm:mx-1">·</span>
                  <span className="text-zinc-200">Кабинет</span>
                </span>
              ) : (
                <span className="line-clamp-2 text-zinc-200 sm:line-clamp-1">
                  Войти через Telegram
                </span>
              )}
            </span>
          </Link>

          <button
            type="button"
            data-cart-fly-target
            onClick={openCart}
            aria-expanded={cartOpen}
            aria-controls="cart-drawer-panel"
            aria-label="Корзина"
            className="relative inline-flex rounded-full bg-green-500 p-2 text-white transition-all duration-300 hover:shadow-lg hover:shadow-green-500/40 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <ShoppingBag className="h-5 w-5 text-white" aria-hidden />
            {count > 0 ? (
              <span className="absolute -right-2 -top-2 rounded-full bg-green-500 px-1.5 text-xs font-bold tabular-nums leading-none text-white ring-2 ring-black">
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {mobileNavOpen ? (
        <div
          id="mobile-nav-panel"
          className="max-h-[min(72vh,560px)] overflow-y-auto overscroll-contain border-t border-white/10 bg-[#070510]/98 px-4 py-4 shadow-[0_24px_48px_rgba(0,0,0,0.65)] backdrop-blur-xl md:hidden"
        >
          <div className="mx-auto flex max-w-[1400px] flex-col gap-5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-black/40 p-1">
              <button
                type="button"
                onClick={() => setCurrency("BYN")}
                className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-semibold uppercase tracking-wide transition ${
                  currency === "BYN"
                    ? "bg-purple-600 text-white shadow-[0_0_14px_rgba(168,85,247,0.35)]"
                    : "text-zinc-500"
                }`}
              >
                BYN
              </button>
              <button
                type="button"
                onClick={() => setCurrency("RUB")}
                className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-semibold uppercase tracking-wide transition ${
                  currency === "RUB"
                    ? "bg-purple-600 text-white shadow-[0_0_14px_rgba(168,85,247,0.35)]"
                    : "text-zinc-500"
                }`}
              >
                RUB
              </button>
            </div>

            <div className="flex flex-col gap-2 border-b border-white/10 pb-4">
              <Link
                href="/favorites"
                className="rounded-xl px-3 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06]"
                onClick={() => setMobileNavOpen(false)}
              >
                Избранное
              </Link>
              <Link
                href={isTgLoggedIn ? "/account" : "/login"}
                className="rounded-xl px-3 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06]"
                onClick={() => setMobileNavOpen(false)}
              >
                {isTgLoggedIn ? (
                  <span className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-emerald-400/95">
                      Вы вошли
                    </span>
                    <span>Личный кабинет</span>
                  </span>
                ) : (
                  "Войти через Telegram"
                )}
              </Link>
            </div>

            {menu.map((section) => (
              <div key={section.title} className="border-b border-white/[0.06] pb-4 last:border-0">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  {section.title}
                </p>
                <ul className="flex flex-col gap-1">
                  {section.items.map((item) => (
                    <li key={`${section.title}-${item.name}-${item.link}`}>
                      <Link
                        href={item.link || "#"}
                        className="block rounded-xl px-3 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
                        onClick={() => setMobileNavOpen(false)}
                      >
                        {item.name || "—"}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
