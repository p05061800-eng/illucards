import type { Metadata } from "next";
import { Suspense } from "react";
import RegisterPageClient from "./RegisterPageClient";

export const metadata: Metadata = {
  title: "Регистрация — IlluCards",
  description: "Создать аккаунт IlluCards",
};

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-20 text-center text-sm text-zinc-500">
          Загрузка…
        </div>
      }
    >
      <RegisterPageClient />
    </Suspense>
  );
}
