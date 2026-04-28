"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
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

function removeAuthParams(sp: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(sp.toString());
  params.delete("user_id");
  params.delete("user");
  params.delete("username");
  params.delete("tg");
  return params;
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
  const widgetBootstrapStarted = useRef(false);

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
      const params = removeAuthParams(searchParams);
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
      return;
    }

    const uid = Math.floor(id);
    const u = searchParams.get("username");
    const uname = u?.trim() ? u.trim().replace(/^@/, "") : null;

    establishSessionFromTelegramUserId(uid, { telegramUsername: uname });

    const params = removeAuthParams(searchParams);
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

  useEffect(() => {
    const tg = searchParams.get("tg");
    if (tg == null) return;

    const stripAuthFlag = () => {
      const params = removeAuthParams(searchParams);
      const q = params.toString();
      return q ? `${pathname}?${q}` : pathname;
    };

    if (tg !== "widget") {
      router.replace(stripAuthFlag(), { scroll: false });
      return;
    }
    if (readTelegramIdParam(searchParams) != null) return;
    if (widgetBootstrapStarted.current) return;
    widgetBootstrapStarted.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/telegram/bootstrap", {
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) {
            router.replace(stripAuthFlag(), { scroll: false });
          }
          return;
        }
        const data = (await res.json()) as {
          profile?: { id?: number; username?: string | null };
        };
        const id = data.profile?.id;
        if (!Number.isFinite(id) || id == null || id <= 0 || id > MAX_TG_ID) {
          if (!cancelled) {
            router.replace(stripAuthFlag(), { scroll: false });
          }
          return;
        }
        const username =
          typeof data.profile?.username === "string"
            ? data.profile.username
            : null;
        establishSessionFromTelegramUserId(Math.floor(id), {
          telegramUsername: username,
        });
        if (!cancelled) {
          router.replace("/account", { scroll: false });
        }
      } catch {
        if (!cancelled) {
          router.replace(stripAuthFlag(), { scroll: false });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    searchParams,
    pathname,
    router,
    establishSessionFromTelegramUserId,
  ]);

  return null;
}
