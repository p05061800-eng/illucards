import type { ReactNode } from "react";

export function LegalPageShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-12 sm:pt-16">
      <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {title}
      </h1>
      <div className="mt-8 space-y-5 text-sm leading-relaxed text-zinc-400">
        {children}
      </div>
    </main>
  );
}
