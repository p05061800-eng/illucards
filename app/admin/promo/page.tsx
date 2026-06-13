import type { Metadata } from "next";
import Link from "next/link";
import { AdminPromoSlidesEditor } from "../AdminPromoSlidesEditor";

export const metadata: Metadata = {
  title: "Акции — админ — IlluCards",
  description: "Баннеры акций под категориями на главной",
};

export default function AdminPromoPage() {
  return (
    <main className="main relative overflow-x-hidden bg-black text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-20%,rgba(88,28,135,0.4),transparent_55%)]"
        aria-hidden
      />
      <div className="relative z-10 p-8 md:p-12">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                <span className="bg-gradient-to-r from-purple-300 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                  Акции на главной
                </span>
              </h1>
              <p className="mt-2 text-zinc-400">
                Слайдер под плашками категорий: автопрокрутка и стрелки на сайте.
              </p>
            </div>
            <Link
              href="/admin"
              className="inline-flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-purple-400/40 hover:bg-white/10 hover:text-white"
            >
              ← К админке
            </Link>
          </div>
          <AdminPromoSlidesEditor />
        </div>
      </div>
    </main>
  );
}
