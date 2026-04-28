import type { Metadata } from "next";
import AccountOrdersPageClient from "./AccountOrdersPageClient";

export const metadata: Metadata = {
  title: "Мои заказы — IlluCards",
  description: "История заказов IlluCards",
};

export default function AccountOrdersPage() {
  return <AccountOrdersPageClient />;
}
