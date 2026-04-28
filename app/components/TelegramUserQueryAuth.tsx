"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";

const MAX_TG_ID = 1e12;

function readTelegramIdParam(sp: URLSearchParams): string | null {
  const a = sp.get("user_id");
  if (a != null && a !== "") return a;
  const legacy = sp.get("user");
  if (legacy != null && legacy !== "") return legacy;
  return null;
}

/**
 * `?user_id=<telegram id>` (или устаревший `?user=`) — сессия, localStorage (`tg_user_id` и др.), без экрана входа.
 */
export function TelegramUserQueryAuth() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { establishSessionFromTelegramUserId } = useAuth();
  const lastRaw = useRef<string | null>(null);

  useLayoutEffect(() => {
    const raw = readTelegramIdParam(searchParams);
    if (raw == null || raw === "") {
      lastRaw.current = null;
      return;
    }
    if (lastRaw.current === raw) return;
    lastRaw.current = raw;

    const id = Number(String(raw).trim());
    if (!Number.isFinite(id) || id <= 0 || id > MAX_TG_ID) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("user_id");
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
    params.delete("user_id");
    params.delete("user");
    params.delete("username");
    const q = params.toString();
    const sanitizedPath = q ? `${pathname}?${q}` : pathname;
    const shouldOpenAccount = !pathname.startsWith("/account");
    router.replace(shouldOpenAccount ? "/account" : sanitizedPath, { scroll: false });
  }, [
    searchParams,
    pathname,
    router,
    establishSessionFromTelegramUserId,
  ]);

  return null;
}
