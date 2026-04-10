"use client";

import Link from "next/link";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/app/context/CartContext";
import { useCurrency } from "@/app/context/CurrencyContext";
import { useFavorites } from "@/app/context/FavoritesContext";
import type { MenuJsonSection } from "@/app/lib/menuJson";
import { focusToStyle } from "@/app/lib/imageFocus";
import { apiUrl } from "@/app/lib/apiUrl";

export default function Header() {
  const pathname = usePathname();
  const [menu, setMenu] = useState<MenuJsonSection[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { favorites, hydrated: favoritesHydrated } = useFavorites();
  const { itemCount, hydrated, cartOpen, openCart } = useCart();
  const count = hydrated ? itemCount : 0;
  const { currency, setCurrency } = useCurrency();

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
      <div className="relative mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-10">
        <Link
          href="/"
          className="site-wordmark shrink-0 text-xl font-bold tracking-tight"
        >
          IlluCards
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-6 md:flex lg:gap-8">
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
                        <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-900/50">
                          {item.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.image}
                              alt=""
                              className="h-full w-full rounded-2xl object-cover transition duration-300 group-hover:brightness-110"
                              style={focusToStyle(item.imageFocus)}
                            />
                          ) : (
                            <div className="flex aspect-[3/4] w-full items-center justify-center bg-zinc-800 text-xs text-zinc-500">
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

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
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
            href="/custom"
            className="hidden text-sm text-zinc-400 transition hover:text-zinc-200 lg:inline"
          >
            Своя карточка
          </Link>

          <Link
            href="/snake"
            className="hidden text-sm text-zinc-400 transition hover:text-zinc-200 lg:inline"
          >
            Snake
          </Link>

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
                href="/custom"
                className="rounded-xl px-3 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06]"
                onClick={() => setMobileNavOpen(false)}
              >
                Своя карточка
              </Link>
              <Link
                href="/snake"
                className="rounded-xl px-3 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06]"
                onClick={() => setMobileNavOpen(false)}
              >
                Snake
              </Link>
              <Link
                href="/favorites"
                className="rounded-xl px-3 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06]"
                onClick={() => setMobileNavOpen(false)}
              >
                Избранное
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
