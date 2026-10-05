import type { Metadata } from "next";
import path from "path";
import { notFound } from "next/navigation";
import type { StoredCard } from "../../api/cards/route";
import { parseCardsJson } from "../../lib/cardsJson";
import type { CategoryTile } from "@/app/lib/categoriesJson";
import { parseCategoriesJson } from "@/app/lib/categoriesJson";
import {
  DURABLE_JSON_KEYS,
  loadDurableJsonText,
} from "@/app/lib/durableJson";
import { resolveTmntCollections } from "@/app/lib/tmntCollections";
import CardProductContent from "./CardProductContent";

export const dynamic = "force-dynamic";

async function loadCards(): Promise<StoredCard[]> {
  const filePath = path.join(process.cwd(), "data", "cards.json");
  const fileData = await loadDurableJsonText(DURABLE_JSON_KEYS.cards, filePath);
  return fileData ? parseCardsJson(fileData) : [];
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const card = (await loadCards()).find((c) => c.id === id);
  if (!card) {
    return { title: "Карточка не найдена — IlluCards" };
  }
  return {
    title: `${card.title} — IlluCards`,
    description: card.description || undefined,
  };
}

export default async function CardPage({ params }: PageProps) {
  const { id } = await params;
  const all = await loadCards();
  const card = all.find((c) => c.id === id);
  if (!card) notFound();

  const cat = card.category?.trim() ?? "";
  const categoryCards =
    cat.length > 0
      ? all.filter((c) => (c.category?.trim() ?? "") === cat)
      : [card];

  let categoryTiles: CategoryTile[] = [];
  try {
    const categoriesPath = path.join(process.cwd(), "data", "categories.json");
    const raw = await loadDurableJsonText(
      DURABLE_JSON_KEYS.categories,
      categoriesPath,
    );
    categoryTiles = raw ? parseCategoriesJson(JSON.parse(raw)) : [];
  } catch {
    categoryTiles = [];
  }
  const tmntCollections = resolveTmntCollections(categoryTiles);

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
        card={card}
        categoryCards={categoryCards}
        allCards={all}
        tmntCollections={tmntCollections}
      />
    </main>
  );
}
