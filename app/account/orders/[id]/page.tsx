import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AccountOrderDetailClient from "./AccountOrderDetailClient";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!id || id.length > 200) return { title: "Заказ — IlluCards" };
  return { title: "Заказ — IlluCards" };
}

export default async function AccountOrderDetailPage({ params }: Props) {
  const { id } = await params;
  if (!id || typeof id !== "string" || id.length > 200 || /[/\\]/.test(id) || id.includes("..")) {
    notFound();
  }
  return <AccountOrderDetailClient orderId={id} />;
}
