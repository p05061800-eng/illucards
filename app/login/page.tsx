import { redirect } from "next/navigation";

/** Маршрут сохранён для совместимости; редирект дублируется в `middleware.ts`. */
export default function LoginPage() {
  redirect("/");
}
