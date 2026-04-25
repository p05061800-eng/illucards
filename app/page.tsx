import HeroSection from "@/components/hero/HeroSection";
import { HomeCollection } from "./components/HomeCollection";
import { parseCardsJson } from "./api/cards/route";
import type { CategoryTile } from "./lib/categoriesJson";
import { parseCategoriesJson } from "./lib/categoriesJson";
import { parseSpotlightConfig } from "./lib/spotlightJson";
import fs from "fs";
import path from "path";

export default function Home() {
  const filePath = path.join(process.cwd(), "data", "cards.json");
  const fileData = fs.readFileSync(filePath, "utf-8");
  const cards = parseCardsJson(fileData);

  const categoriesPath = path.join(process.cwd(), "data", "categories.json");
  let categoryTiles: CategoryTile[] = [];
  try {
    const raw = fs.readFileSync(categoriesPath, "utf-8");
    categoryTiles = parseCategoriesJson(JSON.parse(raw));
  } catch {
    categoryTiles = [];
  }

  const initialHeroCategoryName =
    cards[0]?.category?.trim() ? cards[0].category.trim() : null;

  let spotlightSlides = parseSpotlightConfig(null).slides;
  try {
    const spotlightPath = path.join(process.cwd(), "data", "spotlight.json");
    const raw = fs.readFileSync(spotlightPath, "utf-8");
    spotlightSlides = parseSpotlightConfig(JSON.parse(raw)).slides;
  } catch {
    // дефолт из parseSpotlightConfig
  }

  return (
    <main className="main relative min-h-screen overflow-x-hidden text-white">
      <div className="relative z-10 overflow-visible px-0 pb-16 pt-[10px] sm:px-10 sm:pb-20 sm:pt-4">
        <HeroSection
          cards={cards}
          initialHeroCategoryName={initialHeroCategoryName}
          initialSpotlightSlides={spotlightSlides}
          initialCategories={categoryTiles}
        />

        <section
          id="collection"
          className="mx-auto w-full max-w-[min(100%,1800px)] scroll-mt-24 px-5 pb-8 pt-8 sm:px-10 sm:pb-12 sm:pt-10"
        >
          <h2 className="site-heading mb-10 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            Коллекции
          </h2>
          <HomeCollection cards={cards} categories={categoryTiles} />
        </section>
      </div>
    </main>
  );
}
