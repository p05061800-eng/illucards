"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useAuth } from "@/app/context/AuthContext";

export default function AccountPageClient() {
  const router = useRouter();
  const { user, hydrated, logout } = useAuth();

  const handleLogout = useCallback(() => {
    logout();
    router.push("/");
    router.refresh();
  }, [logout, router]);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center text-sm text-zinc-500">
        Загрузка…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-16 text-center sm:pt-24">
        <h1 className="text-2xl font-semibold text-white">Личный кабинет</h1>
        <p className="mt-3 text-sm text-zinc-500">
          Войдите или зарегистрируйтесь, чтобы видеть бонусы и настройки.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/login?next=/account"
            className="rounded-xl bg-[#5D6BF3] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Войти
          </Link>
          <Link
            href="/register?next=/account"
            className="rounded-xl border border-white/15 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06]"
          >
            Регистрация
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-24 pt-16 sm:pt-24">
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        Личный кабинет
      </h1>
      <p className="mt-1 text-sm text-zinc-500">Демо-профиль (данные только в этом браузере)</p>

      <div className="mt-10 space-y-4 rounded-2xl border border-white/[0.08] bg-zinc-950/60 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <div className="flex justify-between gap-4 border-b border-white/[0.06] pb-4">
          <span className="text-sm text-zinc-500">Email</span>
          <span className="text-sm font-medium text-white">{user.email}</span>
        </div>
        <div className="flex justify-between gap-4 border-b border-white/[0.06] pb-4">
          <span className="text-sm text-zinc-500">Бонусы</span>
          <span className="text-sm font-semibold tabular-nums text-[#5D6BF3]">
            {user.bonusPoints} баллов
          </span>
        </div>
        <p className="text-xs leading-relaxed text-zinc-600">
          После оплаты в тестовом режиме баллы можно начислять вручную в будущих версиях.
        </p>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-8 w-full rounded-xl border border-white/15 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.06]"
      >
        Выйти
      </button>
    </div>
  );
}
