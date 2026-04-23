import type { Metadata } from "next";
import { LegalPageShell } from "@/app/components/LegalPageShell";
import { SITE_CONTACT_EMAIL, SITE_OWNER_LINE } from "@/app/lib/siteLegal";

export const metadata: Metadata = {
  title: "Контакты — IlluCards",
  description: "Контакты интернет-магазина IlluCards",
};

export default function ContactsPage() {
  return (
    <LegalPageShell title="Контакты">
      <p>
        Email:{" "}
        <a
          href={`mailto:${SITE_CONTACT_EMAIL}`}
          className="text-violet-300/95 underline-offset-2 hover:underline"
        >
          {SITE_CONTACT_EMAIL}
        </a>
      </p>
      <p className="text-zinc-300">Владелец: {SITE_OWNER_LINE}</p>
    </LegalPageShell>
  );
}
