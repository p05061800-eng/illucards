"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";

const MAX_TG_ID = 1e12;

/**
 * При открытии сайта с `?user=<telegram user id>` сохраняет сессию (через AuthContext)
 * и убирает параметр из адресной строки.
 */
export function TelegramUserQueryAuth() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { establishSessionFromTelegramUserId, hydrated } = useAuth();
  const lastRaw = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const raw = searchParams.get("user");
    if (raw == null || raw === "") {
      lastRaw.current = null;
      return;
    }
    if (lastRaw.current === raw) return;
    lastRaw.current = raw;

    const id = Number(String(raw).trim());
    if (!Number.isFinite(id) || id <= 0 || id > MAX_TG_ID) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("user");
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
      return;
    }

    const uid = Math.floor(id);
    const u = searchParams.get("username");
    const uname = u?.trim() ? u.trim().replace(/^@/, "") : null;

    establishSessionFromTelegramUserId(uid, { telegramUsername: uname });

    const params = new URLSearchParams(searchParams.toString());
    params.delete("user");
    params.delete("username");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [
    hydrated,
    searchParams,
    pathname,
    router,
    establishSessionFromTelegramUserId,
  ]);

  return null;
}
