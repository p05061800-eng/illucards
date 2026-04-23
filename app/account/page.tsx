import type { Metadata } from "next";
import AccountPageClient from "./AccountPageClient";

export const metadata: Metadata = {
  title: "Личный кабинет — IlluCards",
  description: "Профиль и бонусы IlluCards",
};

export default function AccountPage() {
  return <AccountPageClient />;
}
