import { CART_FLY_TARGET_SELECTOR } from "./constants";

const DURATION_MS = 740;
/** Apple / Nike-подобное замедление в конце */
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Клонирует превью товара и анимирует полёт к плавающей корзине (FAB снизу).
 */
export function flyToCart(source: HTMLElement | null | undefined): void {
  if (typeof window === "undefined" || !source) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const target = document.querySelector(CART_FLY_TARGET_SELECTOR);
  if (!target) return;

  const imgEl = source.querySelector("img");
  const rect = (imgEl ?? source).getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return;

  const endRect = target.getBoundingClientRect();
  const cx0 = rect.left + rect.width / 2;
  const cy0 = rect.top + rect.height / 2;
  const cx1 = endRect.left + endRect.width / 2;
  const cy1 = endRect.top + endRect.height / 2;
  const dx = cx1 - cx0;
  const dy = cy1 - cy0;

  const scaleEnd = Math.max(
    0.1,
    Math.min(0.26, endRect.width / Math.max(rect.width, 1))
  );

  const shell = document.createElement("div");
  shell.setAttribute("aria-hidden", "true");
  shell.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:10060;";

  const flyer = document.createElement("div");
  const radius = Math.min(14, rect.width * 0.08);
  flyer.style.cssText = [
    "position:fixed",
    `left:${cx0}px`,
    `top:${cy0}px`,
    `width:${rect.width}px`,
    `height:${rect.height}px`,
    "transform:translate(-50%,-50%)",
    "transform-origin:center",
    `border-radius:${radius}px`,
    "overflow:hidden",
    "box-shadow:0 14px 44px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.1)",
    "will-change:transform,opacity",
  ].join(";");

  if (imgEl instanceof HTMLImageElement && (imgEl.currentSrc || imgEl.src)) {
    const c = document.createElement("img");
    c.src = imgEl.currentSrc || imgEl.src;
    c.alt = "";
    c.decoding = "async";
    c.style.cssText =
      "width:100%;height:100%;object-fit:contain;display:block";
    flyer.appendChild(c);
  } else {
    flyer.style.background =
      "linear-gradient(145deg, rgb(39 39 42), rgb(88 28 135))";
  }

  shell.appendChild(flyer);
  document.body.appendChild(shell);

  const keyframes: Keyframe[] = [
    {
      transform: "translate(-50%, -50%) scale(1)",
      opacity: 1,
    },
    {
      transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scaleEnd})`,
      opacity: 0.14,
    },
  ];

  const anim = flyer.animate(keyframes, {
    duration: DURATION_MS,
    easing: EASING,
    fill: "forwards",
  });

  anim.onfinish = () => {
    shell.remove();
  };
}
