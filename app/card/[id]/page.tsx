import type { Metadata } from "next";
import path from "path";
import { promises as fs } from "fs";
import { parseCardsJson } from "../../lib/cardsJson";
import { loadProductPageData } from "@/app/lib/loadProductPageData";
import CardProductContent from "./CardProductContent";
import { CardProductClientFallback } from "./CardProductClientFallback";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams(): Promise<{ id: string }[]> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "data", "cards.json"),
      "utf-8",
    );
    return parseCardsJson(raw).map((card) => ({ id: card.id }));
  } catch {
    return [];
  }
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await loadProductPageData(id);
  if (!data) {
    return { title: "IlluCards" };
  }
  const { card } = data;
  const description = (card.description || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  const image = card.frontImage?.trim() || "/icon.png";
  const url = `https://www.illucards.by/card/${card.id}`;
  return {
    title: `${card.title} — IlluCards`,
    description: description || `${card.title} — коллекционная карточка IlluCards`,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "ru_BY",
      url,
      siteName: "IlluCards",
      title: `${card.title} — IlluCards`,
      description:
        description || `${card.title} — коллекционная карточка IlluCards`,
      images: [{ url: image, alt: card.title }],
    },
  };
}

export default async function CardPage({ params }: PageProps) {
  const { id } = await params;
  const data = await loadProductPageData(id);
  if (!data) {
    return <CardProductClientFallback id={id} />;
  }

  return (
    <main className="main relative overflow-x-hidden text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-black"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_-15%,rgba(88,28,135,0.18),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_100%,rgba(30,27,75,0.12),transparent_60%)]"
        aria-hidden
      />

      <CardProductContent
        card={data.card}
        categoryCards={data.categoryCards}
        categoryNames={data.categoryNames}
        firstCardIdByCategory={data.firstCardIdByCategory}
        tmntCollections={data.tmntCollections}
      />
    </main>
  );
}
