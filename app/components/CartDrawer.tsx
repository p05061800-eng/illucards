"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AdultContentBlurGate } from "./AdultContentBlurGate";
import { cardRequiresAgeConfirmation } from "../lib/cardRequiresAgeConfirmation";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import { useCategoryTiles } from "../context/CategoryFramesContext";
import { getCardArtIntrinsicSize } from "../lib/cardArtIntrinsicSize";
import { displayCurrencyForDelivery, formatCardPrice } from "../lib/formatPrice";
import { TelegramCheckoutButton } from "@/components/checkout/TelegramCheckoutButton";
import { DeliveryCountryField } from "./DeliveryCountryField";
import { CartOrderTotals } from "./cart/CartOrderTotals";

export function CartDrawer() {
  const pathname = usePathname();
  const {
    cartItems,
    totalPriceByn,
    totalPriceRub,
    deliveryCountry,
    setDeliveryCountry,
    deliveryPriceByn,
    deliveryPriceRub,
    orderTotalByn,
    orderTotalRub,
    checkoutTotalByn,
    checkoutTotalRub,
    hydrated,
    cartOpen,
    closeCart,
    removeFromCart,
    setQuantity,
  } = useCart();
  const { primaryTelegramUserId } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const priceCurrency = displayCurrencyForDelivery(deliveryCountry);
  const categoryTiles = useCategoryTiles();
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const deliveryFieldId = useId();
  const asideRef = useRef<HTMLDivElement>(null);
  const [swipePx, setSwipePx] = useState(0);
  const [swipeDragging, setSwipeDragging] = useState(false);
  const swipeLastPx = useRef(0);
  const touchRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    locked: "none" | "h" | "v";
  }>({ active: false, startX: 0, startY: 0, locked: "none" });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (pathname !== "/account" || typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("tg_wait")) closeCart();
  }, [pathname, closeCart]);

  useEffect(() => {
    if (!cartOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [cartOpen]);

  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartOpen, closeCart]);

  useEffect(() => {
    if (!cartOpen) {
      setSwipePx(0);
      setSwipeDragging(false);
      swipeLastPx.current = 0;
    }
  }, [cartOpen]);

  useEffect(() => {
    const el = asideRef.current;
    if (!el || !cartOpen) return;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touchRef.current = {
        active: true,
        startX: t.clientX,
        startY: t.clientY,
        locked: "none",
      };
    };

    const onMove = (e: TouchEvent) => {
      if (!touchRef.current.active) return;
      const t = e.touches[0];
      const dx = t.clientX - touchRef.current.startX;
      const dy = t.clientY - touchRef.current.startY;

      if (touchRef.current.locked === "none") {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) + 8) {
          touchRef.current.locked = "h";
          setSwipeDragging(true);
        } else if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) {
          touchRef.current.locked = "v";
          touchRef.current.active = false;
          return;
        } else {
          return;
        }
      }

      if (touchRef.current.locked !== "h") return;

      e.preventDefault();
      const w = el.offsetWidth;
      const next = Math.max(0, Math.min(dx, w));
      swipeLastPx.current = next;
      setSwipePx(next);
    };

    const onEnd = () => {
      if (!touchRef.current.active) return;
      const wasH = touchRef.current.locked === "h";
      const w = el.offsetWidth;
      const x = swipeLastPx.current;
      touchRef.current = {
        active: false,
        startX: 0,
        startY: 0,
        locked: "none",
      };
      setSwipeDragging(false);
      if (wasH && (x > w * 0.22 || x > 72)) {
        closeCart();
      }
      setSwipePx(0);
      swipeLastPx.current = 0;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [cartOpen, closeCart]);

  const onOverlayPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) closeCart();
    },
    [closeCart]
  );

  const drawer = (
    <div
      className="fixed inset-0 z-[400] flex justify-end"
      aria-hidden={!cartOpen}
    >
      <div
        role="presentation"
        className={`absolute inset-0 bg-black/65 backdrop-blur-[2px] transition-[opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
          cartOpen ? "opacity-100" : "opacity-0"
        }`}
        style={{
          opacity: cartOpen
            ? Math.max(0.38, 1 - swipePx / 480)
            : undefined,
        }}
        onPointerDown={onOverlayPointerDown}
        aria-hidden
      />

      <aside
        ref={asideRef}
        id="cart-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-[min(100%,420px)] flex-col border-l border-white/[0.08] bg-zinc-950 shadow-[0_0_80px_rgba(0,0,0,0.85),inset_1px_0_0_rgba(255,255,255,0.06)] motion-reduce:transition-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 120% 80% at 100% 0%, rgba(88, 28, 135, 0.22), transparent 50%),
            radial-gradient(ellipse 80% 50% at 0% 100%, rgba(139, 92, 246, 0.08), transparent 45%),
            linear-gradient(180deg, #09090b 0%, #050506 100%)
          `,
          transform: cartOpen
            ? `translate3d(${swipePx}px, 0, 0)`
            : "translate3d(100%, 0, 0)",
          transition: swipeDragging
            ? "none"
            : "transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent"
          aria-hidden
        />

        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5 sm:px-5">
          <h2
            id={titleId}
            className="bg-gradient-to-r from-white via-purple-100 to-violet-200 bg-clip-text text-base font-semibold tracking-tight text-transparent sm:text-lg"
          >
            Корзина
            {cartItems.length > 0 ? (
              <span className="ml-1.5 text-sm font-medium text-zinc-500">
                ({cartItems.reduce((s, l) => s + l.quantity, 0)})
              </span>
            ) : null}
          </h2>
          <div className="flex items-center gap-2">
            <Link
              href="/cart"
              onClick={closeCart}
              className="hidden rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-300 sm:inline"
            >
              На страницу
            </Link>
            <button
              type="button"
              onClick={closeCart}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
              aria-label="Закрыть корзину"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {!hydrated ? (
            <p className="px-5 py-12 text-center text-sm text-zinc-500 sm:px-6">
              Загрузка…
            </p>
          ) : cartItems.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10 pt-6 text-center">
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-950/80 to-zinc-950 shadow-[0_0_48px_rgba(139,92,246,0.15),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/5">
                <svg
                  className="h-11 w-11 text-purple-400/90"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </div>
              <p className="max-w-[260px] text-sm leading-relaxed text-zinc-400">
                Пока здесь пусто — добавьте карточки из каталога.
              </p>
              <Link
                href="/#collection"
                onClick={closeCart}
                className="mt-8 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 px-8 py-3 text-sm font-semibold text-white shadow-[0_0_32px_rgba(168,85,247,0.45)] ring-1 ring-purple-400/35 transition hover:from-purple-500 hover:via-violet-500 hover:to-fuchsia-500 hover:shadow-[0_0_44px_rgba(192,132,252,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80"
              >
                Перейти к каталогу
              </Link>
            </div>
          ) : (
            <>
              <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-2 sm:px-4">
                {cartItems.map((line) => {
                  const cartArt = getCardArtIntrinsicSize(
                    line.category,
                    categoryTiles,
                  );
                  return (
                  <li
                    key={line.id}
                    className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  >
                    <div className="flex w-[3.75rem] shrink-0 items-start justify-center self-start overflow-visible rounded-lg bg-zinc-900 ring-1 ring-white/10 sm:w-[4.25rem]">
                      {line.frontImage ? (
                        <AdultContentBlurGate
                          isAdult={cardRequiresAgeConfirmation({
                            rarity: line.rarity,
                          })}
                          cardId={line.id}
                          mode="blurOnly"
                        >
                          <Image
                            src={line.frontImage}
                            alt=""
                            width={cartArt.width}
                            height={cartArt.height}
                            className="h-auto w-full rounded-lg"
                            sizes="68px"
                            style={{
                              width: "100%",
                              height: "auto",
                              objectFit: "unset",
                            }}
                          />
                        </AdultContentBlurGate>
                      ) : (
                        <div className="flex min-h-[2.5rem] items-center justify-center text-[10px] text-zinc-600">
                          —
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Link
                        href={`/card/${line.id}`}
                        onClick={closeCart}
                        className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-100 transition hover:text-purple-200"
                      >
                        {line.title}
                      </Link>
                      <p className="text-xs font-medium tabular-nums text-purple-200/90">
                        {formatCardPrice(
                          line.priceByn * line.quantity,
                          priceCurrency,
                          priceCurrency === "RUB"
                            ? line.priceRub * line.quantity
                            : undefined
                        )}
                        <span className="font-normal text-zinc-500">
                          {" "}
                          · {line.quantity} шт.
                        </span>
                      </p>
                      <div className="flex items-center gap-1.5">
                        <div className="inline-flex items-center rounded-md border border-white/12 bg-black/40 text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              setQuantity(line.id, line.quantity - 1)
                            }
                            className="px-2 py-0.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                            aria-label="Уменьшить"
                          >
                            −
                          </button>
                          <span className="min-w-[1.5rem] px-1 text-center tabular-nums text-zinc-200">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setQuantity(line.id, line.quantity + 1)
                            }
                            className="px-2 py-0.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                            aria-label="Увеличить"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(line.id)}
                          className="text-[11px] text-zinc-500 transition hover:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </li>
                  );
                })}
              </ul>

              <div className="shrink-0 space-y-2 border-t border-white/[0.06] bg-black/25 px-3 py-2.5 backdrop-blur-md sm:px-4">
                <DeliveryCountryField
                  id={deliveryFieldId}
                  value={deliveryCountry}
                  onChange={setDeliveryCountry}
                  compact
                />
                {deliveryCountry != null ? (
                  <p className="text-[10px] leading-snug text-zinc-500">
                    Цены в {priceCurrency === "RUB" ? "RUB" : "BYN"} по доставке
                  </p>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Валюта
                    </span>
                    <div
                      className="inline-flex rounded-full border border-white/12 bg-black/50 p-0.5"
                      role="group"
                      aria-label="Валюта"
                    >
                      <button
                        type="button"
                        onClick={() => setCurrency("BYN")}
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                          currency === "BYN"
                            ? "bg-purple-600/90 text-white shadow-[0_0_14px_rgba(168,85,247,0.35)]"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        BY
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrency("RUB")}
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                          currency === "RUB"
                            ? "bg-purple-600/90 text-white shadow-[0_0_14px_rgba(168,85,247,0.35)]"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        RUB
                      </button>
                    </div>
                  </div>
                )}
                <CartOrderTotals
                  deliveryCountry={deliveryCountry}
                  totalPriceByn={totalPriceByn}
                  totalPriceRub={totalPriceRub}
                  deliveryPriceByn={deliveryPriceByn}
                  deliveryPriceRub={deliveryPriceRub}
                  orderTotalByn={orderTotalByn}
                  orderTotalRub={orderTotalRub}
                  checkoutTotalByn={checkoutTotalByn}
                  checkoutTotalRub={checkoutTotalRub}
                />
                <TelegramCheckoutButton
                  onBeforeNavigate={closeCart}
                  className="rounded-full py-3 text-sm shadow-[0_0_36px_rgba(124,58,237,0.5)]"
                />
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );

  return (
    <>
      {/* Пока корзина закрыта — не монтируем оверлей в body, иначе на части устройств он перехватывает касания */}
      {mounted && cartOpen ? createPortal(drawer, document.body) : null}
    </>
  );
}
