import Link from "next/link";
import { SITE_CONTACT_EMAIL } from "@/app/lib/siteLegal";

export function SiteFooter() {
  return (
    <footer
      data-site-footer
      className="mt-auto border-t border-white/[0.08] bg-zinc-950/80 py-8 backdrop-blur-sm"
    >
      <div className="mx-auto flex w-full max-w-[min(100%,1800px)] flex-col gap-6 px-6 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <a
          href={`mailto:${SITE_CONTACT_EMAIL}`}
          className="text-sm text-zinc-400 transition hover:text-zinc-200"
        >
          {SITE_CONTACT_EMAIL}
        </a>
        <nav
          className="flex flex-col gap-3 text-sm sm:flex-row sm:gap-8"
          aria-label="Юридическая информация"
        >
          <Link
            href="/privacy"
            className="text-zinc-500 transition hover:text-zinc-300"
          >
            Политика конфиденциальности
          </Link>
          <Link
            href="/offer"
            className="text-zinc-500 transition hover:text-zinc-300"
          >
            Публичная оферта
          </Link>
          <Link
            href="/contacts"
            className="text-zinc-500 transition hover:text-zinc-300"
          >
            Контакты
          </Link>
        </nav>
      </div>
    </footer>
  );
}
