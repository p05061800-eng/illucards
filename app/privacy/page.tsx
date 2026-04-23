import type { Metadata } from "next";
import { LegalPageShell } from "@/app/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — IlluCards",
  description: "Обработка персональных данных на сайте IlluCards",
};

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Политика конфиденциальности">
      <p>
        Мы собираем и обрабатываем персональные данные пользователей (имя,
        email и другие данные, вводимые на сайте) исключительно для обработки
        заказов и обратной связи.
      </p>
      <p>
        Пользователь даёт согласие на обработку персональных данных при
        отправке любой формы на сайте.
      </p>
      <p>
        Данные не передаются третьим лицам, за исключением случаев,
        предусмотренных законодательством.
      </p>
      <p>
        Пользователь имеет право запросить удаление своих данных, написав на
        email.
      </p>
    </LegalPageShell>
  );
}
