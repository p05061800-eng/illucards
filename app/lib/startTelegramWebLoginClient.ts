import { apiUrl } from "@/app/lib/apiUrl";
import { TG_LOGIN_WAIT_STORAGE_KEY, isValidLoginWaitId } from "@/app/lib/telegramLoginWaitKeys";
import { telegramWebLoginDeepLink } from "@/app/lib/telegramWebLoginUrl";

declare global {
  interface Window {
    __illucardsTgLoginPopup?: Window | null;
  }
}

/**
 * Регистрирует ожидание кода на сервере, сохраняет wait_id в sessionStorage,
 * открывает бота — когда код записан на сайт, фоновый опрос ведёт на /account.
 */
export async function startTelegramWebLoginWithWait(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch(apiUrl("/api/telegram-login-wait"), { method: "POST" });
    if (!res.ok) return false;
    const j = (await res.json()) as { wait_id?: string };
    const id = typeof j.wait_id === "string" ? j.wait_id.trim() : "";
    if (!isValidLoginWaitId(id)) return false;
    sessionStorage.setItem(TG_LOGIN_WAIT_STORAGE_KEY, id.toLowerCase());
    const url = telegramWebLoginDeepLink(id);
    const popup = window.open(
      url,
      "illucards_tg_login",
      "popup=yes,width=520,height=820,menubar=no,toolbar=no,location=yes,status=no,scrollbars=yes,resizable=yes",
    );
    window.__illucardsTgLoginPopup = popup;
    if (popup && !popup.closed) {
      popup.focus();
      // Пользователь остаётся на сайте и сразу попадает в ЛК для ввода кода.
      window.location.assign("https://www.illucards.by/account");
      return true;
    }
    return true;
  } catch {
    return false;
  }
}
