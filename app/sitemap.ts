import type { MetadataRoute } from "next";
import fs from "fs";
import path from "path";
import { parseCardsJson } from "./lib/cardsJson";

const SITE_URL = "https://www.illucards.by";

function loadCardIds(): string[] {
  try {
    const filePath = path.join(process.cwd(), "data", "cards.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return parseCardsJson(raw)
      .map((card) => card.id?.trim())
      .filter((id): id is string => Boolean(id));
  } catch {
    return [];
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/collection`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/contacts`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/offer`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const cardRoutes: MetadataRoute.Sitemap = loadCardIds().map((id) => ({
    url: `${SITE_URL}/card/${id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...cardRoutes];
}
