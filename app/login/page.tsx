import { redirect } from "next/navigation";

/** Маршрут сохранён для совместимости; редирект дублируется в `proxy.ts`. */
export default function LoginPage() {
  redirect("/");
}
