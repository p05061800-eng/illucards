import type { Metadata } from "next";
import { AdminLoginForm } from "./AdminLoginForm";

export const metadata: Metadata = {
  title: "Вход в админку — IlluCards",
  robots: { index: false, follow: false },
};

function safeNextPath(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/admin")) return "/admin";
  if (value.startsWith("//") || value.includes("://")) return "/admin";
  return value;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);

  return (
    <main className="main relative min-h-[70vh] overflow-x-hidden bg-black text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-20%,rgba(88,28,135,0.4),transparent_55%)]"
        aria-hidden
      />
      <div className="relative z-10 flex justify-center p-8 md:p-12">
        <AdminLoginForm nextPath={nextPath} />
      </div>
    </main>
  );
}
