import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Категории — Админ IlluCards",
};

export default function AdminCategoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
