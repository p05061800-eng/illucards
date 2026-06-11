import type { Metadata } from "next";
import { LegalPageShell } from "@/app/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Публичная оферта — IlluCards",
  description: "Условия покупки в интернет-магазине IlluCards",
};

export default function OfferPage() {
  return (
    <LegalPageShell title="Публичная оферта">
      <p>Настоящий сайт является публичной офертой.</p>
      <p>Оформляя заказ, пользователь соглашается с условиями покупки.</p>
      <p>Товары представлены с описанием и ценой.</p>
      <p>Оплата производится доступными способами, указанными на сайте.</p>
      <p>
        Возврат возможен в соответствии с законодательством Республики Беларусь.
      </p>
    </LegalPageShell>
  );
}
