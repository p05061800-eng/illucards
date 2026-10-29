import HeroSection from "@/components/hero/HeroSection";
import { toHeroStorefrontCard } from "./lib/cardsJson";
import { resolveCustomOrderHeroCards } from "./lib/customOrderHeroCarousel";
import { buildNoveltiesCarouselCards } from "./lib/noveltiesHeroCarousel";
import {
  parsePromoHomeConfig,
  type PromoHomeConfig,
} from "./lib/promoSlidesJson";
import { promises as fs } from "fs";
import { loadGitCatalogCards } from "./lib/loadCatalogCards";
import { loadGitCategoryTiles } from "./lib/loadCategoryTiles";
import path from "path";

/** После сохранения в админке `revalidatePath("/")` сразу обновляет главную. */
export const revalidate = 60;

export default async function Home() {
  const emptyPromo: PromoHomeConfig = {
    customOrder: { imageUrl: "", href: "" },
    items: [],
  };
  const promoPath = path.join(process.cwd(), "data", "promo-slides.json");
  const [cardsRaw, categoryTiles, promoFile] = await Promise.all([
    loadGitCatalogCards(),
    loadGitCategoryTiles(),
    fs.readFile(promoPath, "utf-8").catch(() => null),
  ]);

  const initialHeroCategoryName =
    cardsRaw[0]?.category?.trim() ? cardsRaw[0].category.trim() : null;

  let initialPromoConfig: PromoHomeConfig = emptyPromo;
  try {
    initialPromoConfig = promoFile
      ? parsePromoHomeConfig(JSON.parse(promoFile))
      : emptyPromo;
  } catch {
    initialPromoConfig = emptyPromo;
  }

  const customOrderCards = resolveCustomOrderHeroCards(
    cardsRaw,
    initialPromoConfig.customOrder.imageUrl,
  );
  const heroCardIds = new Set<string>();
  const heroCards = [
    ...buildNoveltiesCarouselCards(cardsRaw),
    ...customOrderCards,
  ]
    .filter((card) => {
      if (heroCardIds.has(card.id)) return false;
      heroCardIds.add(card.id);
      return true;
    })
    .map(toHeroStorefrontCard);

  return (
    <main className="main relative min-h-screen overflow-x-hidden text-white">
      <div className="home-main-stack relative z-10 overflow-x-hidden overflow-y-visible px-0 pb-16 pt-0 sm:pb-20 sm:pt-2">
        <HeroSection
          cards={heroCards}
          initialHeroCategoryName={initialHeroCategoryName}
          initialCategories={categoryTiles}
          initialPromoConfig={initialPromoConfig}
        />
      </div>
    </main>
  );
}
