import type { Metadata } from "next";
import { Suspense } from "react";
import LoginPageClient from "./LoginPageClient";

export const metadata: Metadata = {
  title: "Вход — IlluCards",
  description: "Вход в личный кабинет IlluCards",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-20 text-center text-sm text-zinc-500">
          Загрузка…
        </div>
      }
    >
      <LoginPageClient />
    </Suspense>
  );
}
