import { apiUrl } from "@/app/lib/apiUrl";
import { isValidLoginWaitId } from "@/app/lib/telegramLoginWaitKeys";

export type CompleteTelegramWebLoginResult =
  | { ok: true; user_id: number; username: string | null }
  | { ok: false; error: string; status: number };

/** Завершить web_login: сервер проверяет wait_id и возвращает Telegram user id. */
export async function completeTelegramWebLogin(
  waitId: string,
): Promise<CompleteTelegramWebLoginResult> {
  const id = waitId.trim().toLowerCase();
  if (!isValidLoginWaitId(id)) {
    return { ok: false, error: "Некорректная сессия входа", status: 400 };
  }
  try {
    const res = await fetch(apiUrl("/api/telegram-login-wait/complete"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ wait_id: id }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      user_id?: number;
      username?: string | null;
    };
    const uid = data.user_id;
    if (
      !res.ok ||
      typeof uid !== "number" ||
      !Number.isFinite(uid) ||
      uid <= 0
    ) {
      return {
        ok: false,
        error: data.error || "Не удалось выполнить автоматический вход",
        status: res.status || 502,
      };
    }
    return {
      ok: true,
      user_id: Math.floor(uid),
      username:
        typeof data.username === "string" && data.username.trim()
          ? data.username.trim().replace(/^@/, "")
          : null,
    };
  } catch {
    return { ok: false, error: "Ошибка сети", status: 0 };
  }
}
