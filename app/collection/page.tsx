"use client";

import { useEffect } from "react";

/**
 * Старые ссылки `/collection` → главная с тем же якорем (каталог на главной).
 */
export default function CollectionRedirectPage() {
  useEffect(() => {
    const hash = window.location.hash || "#collection";
    window.location.replace(`/${hash}`);
  }, []);

  return (
    <p className="px-6 py-16 text-center text-sm text-zinc-500">
      Переход в каталог…
    </p>
  );
}
