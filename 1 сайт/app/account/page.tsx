import type { Metadata } from "next";
import { Suspense } from "react";
import AccountPageClient from "./AccountPageClient";

export const metadata: Metadata = {
  title: "Личный кабинет — IlluCards",
  description: "Профиль и заказы после входа через Telegram",
};

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-20 text-center text-sm text-zinc-500">
          Загрузка…
        </div>
      }
    >
      <AccountPageClient />
    </Suspense>
  );
}
