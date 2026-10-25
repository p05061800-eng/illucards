import HeroSection from "@/components/hero/HeroSection";
import { HomeCollection } from "./components/HomeCollection";
import { toStorefrontCard } from "./lib/cardsJson";
import type { CategoryTile } from "./lib/categoriesJson";
import { parseCategoriesJson } from "./lib/categoriesJson";
import { resolveCustomOrderHeroCards } from "./lib/customOrderHeroCarousel";
import { buildNoveltiesCarouselCards } from "./lib/noveltiesHeroCarousel";
import {
  parsePromoHomeConfig,
  type PromoHomeConfig,
} from "./lib/promoSlidesJson";
import {
  DURABLE_JSON_KEYS,
  loadDurableJsonText,
} from "./lib/durableJson";
import { loadCatalogCards } from "./lib/loadCatalogCards";
import path from "path";

/** После сохранения в админке `revalidatePath("/")` сразу обновляет главную. */
export const revalidate = 60;

export default async function Home() {
  const cards = (await loadCatalogCards()).map(toStorefrontCard);

  const categoriesPath = path.join(process.cwd(), "data", "categories.json");
  let categoryTiles: CategoryTile[] = [];
  try {
    const raw = await loadDurableJsonText(
      DURABLE_JSON_KEYS.categories,
      categoriesPath,
    );
    categoryTiles = raw ? parseCategoriesJson(JSON.parse(raw)) : [];
  } catch {
    categoryTiles = [];
  }

  const initialHeroCategoryName =
    cards[0]?.category?.trim() ? cards[0].category.trim() : null;

  let initialPromoConfig: PromoHomeConfig = {
    customOrder: { imageUrl: "", href: "" },
    items: [],
  };
  try {
    const promoPath = path.join(process.cwd(), "data", "promo-slides.json");
    const promoRaw = await loadDurableJsonText(
      DURABLE_JSON_KEYS.promo,
      promoPath,
    );
    initialPromoConfig = promoRaw
      ? parsePromoHomeConfig(JSON.parse(promoRaw))
      : initialPromoConfig;
  } catch {
    initialPromoConfig = {
      customOrder: { imageUrl: "", href: "" },
      items: [],
    };
  }

  const customOrderCards = resolveCustomOrderHeroCards(
    cards,
    initialPromoConfig.customOrder.imageUrl,
  );
  const heroCardIds = new Set<string>();
  const heroCards = [
    ...buildNoveltiesCarouselCards(cards),
    ...customOrderCards,
  ].filter((card) => {
    if (heroCardIds.has(card.id)) return false;
    heroCardIds.add(card.id);
    return true;
  });

  return (
    <main className="main relative min-h-screen overflow-x-hidden text-white">
      <div className="home-main-stack relative z-10 overflow-x-hidden overflow-y-visible px-0 pb-16 pt-[6px] sm:pb-20 sm:pt-2">
        <HeroSection
          cards={heroCards}
          initialHeroCategoryName={initialHeroCategoryName}
          initialCategories={categoryTiles}
          initialPromoConfig={initialPromoConfig}
        />

        <section
          id="collection"
          className="mx-auto w-full max-w-[min(100%,1800px)] scroll-mt-24 px-5 pb-8 pt-0 sm:px-10 sm:pb-12"
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
