"use client";

import { useEffect, useState } from "react";
import type { SocialLinksConfig, SocialNetworkId } from "@/app/lib/socialLinksJson";
import {
  DEFAULT_SOCIAL_LINKS_CONFIG,
  SOCIAL_NETWORK_LABELS,
  SOCIAL_NETWORK_ORDER,
} from "@/app/lib/socialLinksJson";
import { apiUrl } from "@/app/lib/apiUrl";

type Props = {
  initialConfig?: SocialLinksConfig;
  /** Компактные кубики для центра шапки */
  compact?: boolean;
  className?: string;
};

const cubeClassPage =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 text-[11px] font-bold uppercase tracking-tight text-white shadow-lg transition will-change-transform [transform:translateZ(0)] hover:scale-[1.08] hover:shadow-xl active:scale-[1.02] sm:h-14 sm:w-14 sm:text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400";

const cubeClassHeader =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[10px] font-bold uppercase tracking-tight text-white shadow-md transition will-change-transform [transform:translateZ(0)] hover:scale-[1.06] hover:shadow-lg active:scale-[1.02] sm:h-10 sm:w-10 sm:text-[11px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 [&_svg]:!h-[18px] [&_svg]:!w-[18px] sm:[&_svg]:!h-5 sm:[&_svg]:!w-5";

const brandCube: Record<
  SocialNetworkId,
  { gradient: string; content: React.ReactNode }
> = {
  vk: {
    gradient: "bg-gradient-to-br from-[#0077FF] to-[#005fcc]",
    content: (
      <span className="select-none font-bold leading-none tracking-tight">
        VK
      </span>
    ),
  },
  tiktok: {
    gradient: "bg-gradient-to-br from-[#00f2ea] via-[#ff0050] to-[#0a0a0a]",
    content: (
      <span className="select-none text-[13px] font-extrabold leading-none tracking-tight sm:text-sm">
        TT
      </span>
    ),
  },
  instagram: {
    gradient:
      "bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]",
    content: (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6 text-white"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  youtube: {
    gradient: "bg-gradient-to-br from-[#FF0000] to-[#cc0000]",
    content: (
      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7 text-white"
        fill="currentColor"
        aria-hidden
      >
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  threads: {
    gradient: "bg-gradient-to-br from-zinc-700 to-zinc-950",
    content: (
      <span className="select-none text-lg font-bold leading-none">@</span>
    ),
  },
  telegram: {
    gradient: "bg-gradient-to-br from-[#2AABEE] to-[#229ED9]",
    content: (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6 text-white"
        fill="currentColor"
        aria-hidden
      >
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
};

export function SocialLinksBar({
  initialConfig,
  compact = false,
  className,
}: Props) {
  const [config, setConfig] = useState<SocialLinksConfig>(() =>
    initialConfig ?? DEFAULT_SOCIAL_LINKS_CONFIG
  );

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/social-links"))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: unknown) => {
        if (cancelled || !data || typeof data !== "object") return;
        if ("links" in data && typeof (data as { links: unknown }).links === "object") {
          setConfig(data as SocialLinksConfig);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const items = SOCIAL_NETWORK_ORDER.map((id) => ({
    id,
    href: (config.links[id] ?? "").trim(),
    label: SOCIAL_NETWORK_LABELS[id],
  })).filter((x) => x.href.length > 0);

  if (items.length === 0) return null;

  const cubeClass = compact ? cubeClassHeader : cubeClassPage;

  return (
    <nav
      className={
        compact
          ? className ?? ""
          : "relative z-20 mx-auto w-full max-w-[1400px] px-6 lg:px-10"
      }
      aria-label="Социальные сети"
    >
      <ul
        className={
          compact
            ? "flex flex-wrap items-center justify-center gap-2 sm:gap-2.5"
            : "flex flex-wrap items-center justify-center gap-3 pb-4 pt-1 sm:gap-4 sm:pb-5 sm:pt-2"
        }
      >
        {items.map(({ id, href, label }) => {
          const b = brandCube[id];
          return (
            <li key={id}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className={`${cubeClass} ${b.gradient}`}
              >
                {b.content}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
