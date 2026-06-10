import { apiUrl } from "@/app/lib/apiUrl";
import { isValidLoginWaitId } from "@/app/lib/telegramLoginWaitKeys";
import {
  notifyLoginWaitStarted,
  persistLoginWaitId,
} from "@/app/lib/telegramLoginWaitStorage";
import { telegramWebLoginDeepLink } from "@/app/lib/telegramWebLoginUrl";

declare global {
  interface Window {
    __illucardsTgLoginPopup?: Window | null;
  }
}

/**
 * Регистрирует ожидание на сервере, сохраняет wait_id,
 * открывает бота — после подтверждения вход выполняется автоматически.
 */
export async function startTelegramWebLoginWithWait(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch(apiUrl("/api/telegram-login-wait"), { method: "POST" });
    if (!res.ok) return false;
    const j = (await res.json()) as { wait_id?: string };
    const id = typeof j.wait_id === "string" ? j.wait_id.trim() : "";
    if (!isValidLoginWaitId(id)) return false;
    persistLoginWaitId(id);
    notifyLoginWaitStarted();
    const url = telegramWebLoginDeepLink(id);
    const popup = window.open(
      url,
      "_blank",
      "popup=yes,width=520,height=820,menubar=no,toolbar=no,location=yes,status=no,scrollbars=yes,resizable=yes",
    );
    window.__illucardsTgLoginPopup = popup;
    if (popup && !popup.closed) popup.focus();
    return true;
  } catch {
    return false;
  }
}
