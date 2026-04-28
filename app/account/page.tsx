import type { Metadata } from "next";
import AccountPageClient from "./AccountPageClient";

export const metadata: Metadata = {
  title: "Личный кабинет — IlluCards",
  description: "Профиль и заказы после входа через Telegram",
};

export default function AccountPage() {
  return <AccountPageClient />;
}
