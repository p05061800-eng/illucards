import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Каталог — IlluCards",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://www.illucards.by/" },
};

export default function CollectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
