import type { Metadata } from "next";
import Link from "next/link";
import { CatalogBackLink } from "@/app/components/CatalogBackLink";
import { loadGitCategoryTiles } from "@/app/lib/loadCategoryTiles";
import { collectionPath } from "@/app/lib/collectionAnchor";
import { categoryFocusToStyle } from "@/app/lib/imageFocus";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Коллекции — IlluCards",
  description: "Все коллекции карточек IlluCards",
  alternates: { canonical: "https://www.illucards.by/collection" },
  openGraph: {
    type: "website",
    locale: "ru_BY",
    url: "https://www.illucards.by/collection",
    siteName: "IlluCards",
    title: "Коллекции — IlluCards",
  },
};

export default async function CollectionIndexPage() {
  const tiles = await loadGitCategoryTiles();

  return (
    <main className="main relative min-h-screen overflow-x-hidden text-white">
      <div className="collection-index mx-auto w-full max-w-[min(100%,1800px)] px-4 py-3 sm:px-8 sm:py-5">
        <CatalogBackLink href="/" parent="home" />
        <h1
          id="collection"
          className="site-heading scroll-mt-24 text-2xl font-bold tracking-tight text-balance sm:text-3xl"
        >
          Коллекции
        </h1>
        {tiles.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-500">Коллекции пока не добавлены.</p>
        ) : (
          <ul className="collection-index-grid mt-5 sm:mt-7">
            {tiles.map((tile) => {
              const plateSrc = (tile.plateImage?.trim() || tile.image || "").trim();
              const plateFocus = tile.plateImage?.trim()
                ? tile.plateImageFocus
                : tile.imageFocus;
              return (
                <li key={tile.name}>
                  <Link
                    href={collectionPath(tile.name)}
                    className="collection-index-tile group"
                  >
                    <span className="collection-index-plate">
                      {plateSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={plateSrc}
                          alt=""
                          className="collection-index-plate-img"
                          style={categoryFocusToStyle(plateFocus)}
                          draggable={false}
                        />
                      ) : (
                        <span className="collection-index-plate-fallback" aria-hidden />
                      )}
                    </span>
                    <span className="collection-index-name">{tile.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
