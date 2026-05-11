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

const socialItemPage =
  "social-item rounded-lg border border-white/10 text-[clamp(8px,1.4vw,10px)] font-bold uppercase tracking-tight text-white shadow-md transition will-change-transform [transform:translateZ(0)] hover:scale-[1.06] hover:shadow-lg active:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400";

const socialItemHeader =
  "social-item rounded-md border border-white/10 text-[clamp(7px,1.2vw,9px)] font-bold uppercase tracking-tight text-white shadow-sm transition will-change-transform [transform:translateZ(0)] hover:scale-[1.05] hover:shadow-md active:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400";

const brandCube: Record<
  SocialNetworkId,
  { gradient: string; content: React.ReactNode }
> = {
  vk: {
    gradient: "bg-gradient-to-br from-[#0077FF] to-[#005fcc]",
    content: (
      <svg viewBox="0 0 24 24" className="h-[78%] w-[78%] text-white" fill="currentColor" aria-hidden>
        <path d="M13.162 18.994c-8.2 0-12.873-5.62-13.062-14.988h4.108c.135 6.875 3.165 9.79 5.565 10.39V4.006h3.868v5.93c2.37-.255 4.86-2.955 5.7-5.93h3.87c-.645 3.66-3.345 6.36-5.265 7.47 1.92.9 4.995 3.255 6.165 7.518h-4.26c-.915-2.85-3.195-5.055-6.21-5.355v5.355h-.48Z" />
      </svg>
    ),
  },
  tiktok: {
    gradient: "bg-gradient-to-br from-[#111111] via-[#111111] to-[#ff0050]",
    content: (
      <svg viewBox="0 0 24 24" className="h-[78%] w-[78%] text-white" fill="currentColor" aria-hidden>
        <path d="M16.6 5.82a5.58 5.58 0 0 0 3.28 1.05V10a8.77 8.77 0 0 1-3.3-.66v5.98a5.67 5.67 0 1 1-5.67-5.67c.35 0 .69.03 1.02.1v3.26a2.52 2.52 0 1 0 1.77 2.4V2h2.9c.12 1.48.91 2.77 2.05 3.55-.63.18-1.31.27-2.05.27Z" />
      </svg>
    ),
  },
  instagram: {
    gradient:
      "bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]",
    content: (
      <svg
        viewBox="0 0 24 24"
        className="h-[78%] w-[78%] text-white"
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
        className="h-[78%] w-[78%] text-white"
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
      <svg viewBox="0 0 24 24" className="h-[78%] w-[78%] text-white" fill="currentColor" aria-hidden>
        <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.88-6.433 2.523-8.484C5.845 1.205 8.598.024 12.18 0h.014c2.695.018 4.916.696 6.6 2.015 1.592 1.246 2.684 3.002 3.246 5.22l-3.184.802c-.793-3.14-2.973-4.708-6.668-4.733-2.543.018-4.421.768-5.584 2.229-1.195 1.5-1.809 3.676-1.826 6.467.017 2.791.631 4.967 1.826 6.467 1.163 1.461 3.041 2.211 5.584 2.229 2.292-.016 3.853-.552 5.066-1.738 1.376-1.345 1.353-2.985.9-3.977-.263-.576-.72-1.051-1.333-1.404-.156 1.16-.526 2.117-1.105 2.86-.817 1.048-1.991 1.605-3.491 1.657-1.136.039-2.227-.236-3.071-.774-.994-.634-1.576-1.594-1.64-2.704-.126-2.186 1.6-3.803 4.293-4.025.961-.079 1.864-.052 2.699.079-.111-.654-.339-1.164-.684-1.525-.474-.496-1.207-.754-2.179-.766h-.029c-.779 0-1.848.216-2.528 1.232l-2.726-1.488c1.02-1.787 2.875-2.775 5.241-2.775h.048c4.189.026 6.685 2.665 6.868 7.263 1.512.719 2.616 1.836 3.208 3.132 1.041 2.279.635 5.379-1.854 7.812C17.793 23.129 15.548 23.978 12.186 24Zm.759-10.387c-.324 0-.662.014-1.015.043-1.542.127-2.006.738-1.979 1.205.028.487.682 1.053 1.709 1.017 1.175-.041 2.532-.502 2.823-2.071-.484-.127-.998-.194-1.538-.194Z" />
      </svg>
    ),
  },
  telegram: {
    gradient: "bg-gradient-to-br from-[#2AABEE] to-[#229ED9]",
    content: (
      <svg
        viewBox="0 0 24 24"
        className="h-[78%] w-[78%] text-white"
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

  const itemClass = compact ? socialItemHeader : socialItemPage;

  return (
    <nav
      className={
        compact
          ? ["flex shrink-0 items-center", className].filter(Boolean).join(" ")
          : "relative z-20 mx-auto w-full max-w-[1400px] px-6 lg:px-10"
      }
      aria-label="Социальные сети"
    >
      <ul
        className={
          compact
            ? "socials"
            : "socials justify-center px-0 pb-4 pt-1 lg:px-4"
        }
      >
        {items.map(({ id, href, label }) => {
          const b = brandCube[id];
          return (
            <li key={id} className="shrink-0">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className={`${itemClass} ${b.gradient}`}
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
