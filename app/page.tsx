import Link from "next/link";
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
      <div className="home-main-stack relative z-10 overflow-x-hidden overflow-y-visible px-0 pb-16 pt-[6px] sm:pb-20 sm:pt-2">
        <HeroSection
          cards={heroCards}
          initialHeroCategoryName={initialHeroCategoryName}
          initialCategories={categoryTiles}
          initialPromoConfig={initialPromoConfig}
        />

        <section
          id="collection"
          className="mx-auto w-full max-w-[min(100%,1800px)] scroll-mt-24 px-5 pb-8 pt-6 sm:px-10 sm:pb-12 sm:pt-8"
        >
          <div className="flex justify-center">
            <Link
              href="/collection"
              className="inline-flex items-center justify-center rounded-xl border border-violet-500/35 bg-violet-950/35 px-8 py-3 text-sm font-semibold text-violet-100 shadow-[0_0_24px_rgba(139,92,246,0.15)] transition hover:border-violet-400/55 hover:bg-violet-900/45 hover:text-white"
            >
              Смотреть все коллекции
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
