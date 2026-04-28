"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useCallback, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import {
  readTelegramPrimaryUserId,
  readTelegramUserLink,
} from "@/app/lib/telegramUserIdentity";

type LsGate = "pending" | "ok" | "no_telegram";

export default function AccountPageClient() {
  const router = useRouter();
  const { user, hydrated, logout } = useAuth();
  const [lsGate, setLsGate] = useState<LsGate>("pending");

  useEffect(() => {
    const id = readTelegramPrimaryUserId();
    if (id == null) {
      router.replace("/");
      setLsGate("no_telegram");
      return;
    }
    setLsGate("ok");
  }, [router]);

  const handleLogout = useCallback(() => {
    logout();
    router.push("/");
    router.refresh();
  }, [logout, router]);

  if (lsGate === "pending") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center text-sm text-zinc-500">
        Загрузка…
      </div>
    );
  }

  if (lsGate === "no_telegram") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center text-sm text-zinc-500">
        Переход на главную…
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center text-sm text-zinc-500">
        Загрузка…
      </div>
    );
  }

  const telegramId = readTelegramPrimaryUserId();
  if (telegramId == null) {
    return null;
  }

  const fromLs = readTelegramUserLink();
  const fromSession =
    user?.telegramId != null && user.telegramId === telegramId ? user : null;
  const rawUsername =
    fromSession?.telegramUsername?.trim() ||
    (fromLs?.user_id === telegramId ? fromLs.username : null) ||
    "";
  const username = rawUsername.replace(/^@/, "").trim();
  const showUsername = username.length > 0;

  return (
    <div
      className="mx-auto w-full max-w-2xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pt-6 md:max-w-3xl md:px-6"
      data-account-marketplace
    >
      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">
        Личный кабинет
      </h1>
      <p className="mt-1 text-sm text-zinc-500">Профиль и заказы</p>

      <div className="mt-6 space-y-3 rounded-2xl bg-zinc-50 p-5 text-zinc-900 shadow-[0_2px_12px_rgba(0,0,0,0.12)] ring-1 ring-zinc-200/90 sm:rounded-3xl sm:p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Профиль
        </h2>
        <p className="text-sm text-zinc-600">
          <span className="text-zinc-500">Username:</span>{" "}
          {showUsername ? (
            <span className="font-medium text-zinc-900">@{username}</span>
          ) : (
            <span className="text-zinc-400">—</span>
          )}
        </p>
        <p className="text-sm text-zinc-600">
          <span className="text-zinc-500">Telegram ID:</span>{" "}
          <span className="font-mono font-medium tabular-nums text-zinc-900">
            {telegramId}
          </span>
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:gap-4">
        <Link
          href="/account/orders"
          className="inline-flex min-h-[3.25rem] flex-1 items-center justify-center rounded-xl bg-[#5D6BF3] px-4 text-center text-base font-semibold text-white shadow-md shadow-indigo-900/25 transition hover:brightness-110 active:scale-[0.99] sm:min-h-14"
        >
          Мои заказы
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex min-h-[3.25rem] flex-1 items-center justify-center rounded-xl border-2 border-zinc-600/80 bg-zinc-900/40 px-4 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60 active:scale-[0.99] sm:min-h-14"
        >
          Выйти
        </button>
      </div>
    </div>
  );
}
