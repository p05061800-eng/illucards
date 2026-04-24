import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import { parseCardsJson, type StoredCard } from "../../api/cards/route";
import CardProductContent from "./CardProductContent";

function loadCards(): StoredCard[] {
  const filePath = path.join(process.cwd(), "data", "cards.json");
  const fileData = fs.readFileSync(filePath, "utf-8");
  return parseCardsJson(fileData);
}

function cardById(id: string): StoredCard | undefined {
  return loadCards().find((c) => c.id === id);
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const card = cardById(id);
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
  const all = loadCards();
  const card = cardById(id);
  if (!card) notFound();

  const cat = card.category?.trim() ?? "";
  const categoryCards =
    cat.length > 0
      ? all.filter((c) => (c.category?.trim() ?? "") === cat)
      : [card];

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
      />
    </main>
  );
}
