"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Регистрация сведена к входу через Telegram. */
export default function RegisterPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const next = searchParams.get("next");
    const q =
      next && next.startsWith("/")
        ? `?next=${encodeURIComponent(next)}`
        : "";
    router.replace(`/login${q}`);
  }, [router, searchParams]);

  return (
    <div className="mx-auto flex min-h-[30vh] max-w-md items-center justify-center px-4 py-20">
      <p className="text-sm text-zinc-500">Перенаправление на страницу входа…</p>
    </div>
  );
}
