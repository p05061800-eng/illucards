/**
 * Ссылки на соцсети в шапке главной (редактируются в /admin/social).
 */

export type SocialNetworkId =
  | "vk"
  | "tiktok"
  | "instagram"
  | "youtube"
  | "threads"
  | "telegram";

export type SocialLinksConfig = {
  links: Record<SocialNetworkId, string>;
};

export const SOCIAL_NETWORK_ORDER: SocialNetworkId[] = [
  "vk",
  "tiktok",
  "instagram",
  "youtube",
  "threads",
  "telegram",
];

export const SOCIAL_NETWORK_LABELS: Record<SocialNetworkId, string> = {
  vk: "VK",
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  threads: "Threads",
  telegram: "Telegram",
};

const EMPTY_LINKS: Record<SocialNetworkId, string> = {
  vk: "",
  tiktok: "",
  instagram: "",
  youtube: "",
  threads: "",
  telegram: "",
};

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Добавляет https:// если схемы нет. */
export function normalizeSocialUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export function parseSocialLinksConfig(input: unknown): SocialLinksConfig {
  const links: Record<SocialNetworkId, string> = { ...EMPTY_LINKS };
  if (!input || typeof input !== "object") return { links };

  const o = input as Record<string, unknown>;
  const rawLinks = o.links;
  if (!rawLinks || typeof rawLinks !== "object") return { links };

  for (const id of SOCIAL_NETWORK_ORDER) {
    const u = normalizeSocialUrl(trimStr((rawLinks as Record<string, unknown>)[id]));
    links[id] = u;
  }
  return { links };
}

export function normalizeSocialLinksConfig(
  config: SocialLinksConfig
): SocialLinksConfig {
  const links = { ...EMPTY_LINKS };
  for (const id of SOCIAL_NETWORK_ORDER) {
    links[id] = normalizeSocialUrl(config.links[id] ?? "");
  }
  return { links };
}

export const DEFAULT_SOCIAL_LINKS_CONFIG: SocialLinksConfig = {
  links: { ...EMPTY_LINKS },
};
