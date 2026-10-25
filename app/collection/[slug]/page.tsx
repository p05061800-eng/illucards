import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HomeCollection } from "@/app/components/HomeCollection";
import { toStorefrontCard } from "@/app/lib/cardsJson";
import {
  cardBelongsToCollectionName,
  collectionPath,
  collectionSlugFromName,
  findCategoryNameBySlug,
  uniqueCollectionNames,
} from "@/app/lib/collectionAnchor";
import { loadGitCatalogCards } from "@/app/lib/loadCatalogCards";
import { loadGitCategoryTiles } from "@/app/lib/loadCategoryTiles";

export const revalidate = 60;
export const dynamicParams = true;

async function resolveCollection(slug: string) {
  const [cardsRaw, tiles] = await Promise.all([
    loadGitCatalogCards(),
    loadGitCategoryTiles(),
  ]);
  const names = uniqueCollectionNames(
    tiles,
    cardsRaw.map((c) => c.category ?? ""),
  );
  const name = findCategoryNameBySlug(slug, names);
  if (!name) return null;
  const cards = cardsRaw
    .filter((c) => cardBelongsToCollectionName(c.category, name))
    .map(toStorefrontCard);
  return { name, cards, tiles };
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const [cardsRaw, tiles] = await Promise.all([
      loadGitCatalogCards(),
      loadGitCategoryTiles(),
    ]);
    return uniqueCollectionNames(
      tiles,
      cardsRaw.map((c) => c.category ?? ""),
    ).map((name) => ({ slug: collectionSlugFromName(name) }));
  } catch {
    return [];
  }
}

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await resolveCollection(slug);
  if (!data) {
    return { title: "Коллекция — IlluCards" };
  }
  const url = `https://www.illucards.by${collectionPath(data.name)}`;
  return {
    title: `${data.name} — IlluCards`,
    description: `Коллекция ${data.name} — карточки IlluCards`,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "ru_BY",
      url,
      siteName: "IlluCards",
      title: `${data.name} — IlluCards`,
    },
  };
}

export default async function CollectionSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await resolveCollection(slug);
  if (!data) notFound();

  return (
    <main className="main relative min-h-screen overflow-x-hidden text-white">
      <div
        id="collection"
        className="mx-auto w-full max-w-[min(100%,1800px)] scroll-mt-24 px-5 pb-16 pt-6 sm:px-10 sm:pb-20 sm:pt-8"
      >
        <Link
          href="/collection"
          className="mb-6 inline-flex text-sm font-medium text-violet-300/90 transition hover:text-violet-200 hover:underline"
        >
          ← Все коллекции
        </Link>
        <h1 className="sr-only">{data.name}</h1>
        <HomeCollection
          cards={data.cards}
          categories={data.tiles}
          lockedCategory={data.name}
        />
      </div>
    </main>
  );
}
