"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/app/lib/adminFetch";

type Props = {
  nextPath: string;
};

export function AdminLoginForm({ nextPath }: Props) {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await adminFetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Не удалось войти. Проверьте логин и пароль.",
        );
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950/70 p-6 shadow-[0_0_40px_rgba(168,85,247,0.18)] backdrop-blur-md md:p-8"
    >
      <h1 className="text-2xl font-bold tracking-tight">
        <span className="bg-gradient-to-r from-purple-300 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
          Вход в админку
        </span>
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        Только для добавления и правки карточек на сайте.
      </p>

      <label className="mt-6 block text-sm font-medium text-zinc-300">
        Логин
        <input
          name="login"
          autoComplete="username"
          value={login}
          onChange={(ev) => setLogin(ev.target.value)}
          className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-white outline-none ring-purple-500/40 transition focus:border-purple-400/50 focus:ring-2"
          required
        />
      </label>

      <label className="mt-4 block text-sm font-medium text-zinc-300">
        Пароль
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
          className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-white outline-none ring-purple-500/40 transition focus:border-purple-400/50 focus:ring-2"
          required
        />
      </label>

      {error ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-purple-500/40 bg-purple-600/80 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_24px_rgba(168,85,247,0.3)] transition hover:bg-purple-500 disabled:opacity-60"
      >
        {pending ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
