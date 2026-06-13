import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Меню — Админ IlluCards",
};

export default function AdminMenuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
