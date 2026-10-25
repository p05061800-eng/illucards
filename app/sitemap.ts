import type { MetadataRoute } from "next";
import fs from "fs";
import path from "path";
import { parseCardsJson } from "./lib/cardsJson";
import { parseCategoriesJson } from "./lib/categoriesJson";
import {
  collectionPath,
  uniqueCollectionNames,
} from "./lib/collectionAnchor";

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

function loadCollectionRoutes(): string[] {
  try {
    const cardsPath = path.join(process.cwd(), "data", "cards.json");
    const catsPath = path.join(process.cwd(), "data", "categories.json");
    const cards = parseCardsJson(fs.readFileSync(cardsPath, "utf-8"));
    const tiles = parseCategoriesJson(
      JSON.parse(fs.readFileSync(catsPath, "utf-8")),
    );
    return uniqueCollectionNames(
      tiles,
      cards.map((c) => c.category ?? ""),
    ).map((name) => collectionPath(name));
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

  const collectionRoutes: MetadataRoute.Sitemap = loadCollectionRoutes().map(
    (href) => ({
      url: `${SITE_URL}${href}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    }),
  );

  const cardRoutes: MetadataRoute.Sitemap = loadCardIds().map((id) => ({
    url: `${SITE_URL}/card/${id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...collectionRoutes, ...cardRoutes];
}
