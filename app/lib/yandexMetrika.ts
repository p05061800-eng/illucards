/** Счётчик Яндекс Метрики (можно переопределить через NEXT_PUBLIC_YANDEX_METRIKA_ID). */
export const YANDEX_METRIKA_ID = Number(
  process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ?? "110372289",
);

export const YANDEX_METRIKA_TELEGRAM_GOAL = "telegram_click";

declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...args: unknown[]) => void;
  }
}

export function isTelegramExternalUrl(url: string): boolean {
  const raw = url.trim();
  if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) {
    return false;
  }
  if (raw.startsWith("tg://")) {
    return true;
  }

  try {
    const base =
      typeof window !== "undefined" ? window.location.href : "https://www.illucards.by/";
    const host = new URL(raw, base).hostname.toLowerCase();
    return (
      host === "t.me" ||
      host.endsWith(".t.me") ||
      host === "telegram.me" ||
      host.endsWith(".telegram.me")
    );
  } catch {
    return /^https?:\/\/(?:[\w.-]+\.)?(?:t\.me|telegram\.me)(?:\/|$)/i.test(raw);
  }
}

export function trackTelegramClick(): void {
  if (typeof window === "undefined") return;
  console.log("telegram_click fired");
  window.ym?.(YANDEX_METRIKA_ID, "reachGoal", YANDEX_METRIKA_TELEGRAM_GOAL);
}

export function openTelegramUrl(
  url: string,
  target = "_blank",
  features?: string,
): Window | null {
  if (!isTelegramExternalUrl(url)) {
    return features
      ? window.open(url, target, features)
      : window.open(url, target, "noopener,noreferrer");
  }

  trackTelegramClick();
  return features
    ? window.open(url, target, features)
    : window.open(url, target, "noopener,noreferrer");
}

export function redirectToTelegramUrl(url: string): void {
  if (isTelegramExternalUrl(url)) {
    trackTelegramClick();
  }
  window.location.href = url;
}
