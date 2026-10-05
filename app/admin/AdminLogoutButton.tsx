"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/app/lib/adminFetch";

export function AdminLogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const onClick = async () => {
    setPending(true);
    try {
      await adminFetch("/api/admin/logout", { method: "POST" });
    } catch {
      /* всё равно уходим на форму входа */
    }
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={pending}
      className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-red-400/40 hover:bg-white/10 hover:text-white disabled:opacity-60"
    >
      {pending ? "Выходим…" : "Выйти"}
    </button>
  );
}
