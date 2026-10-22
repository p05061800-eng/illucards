import { apiUrl } from "@/app/lib/apiUrl";

/** Fetch из админки: всегда отправляет cookie сессии после входа. */
export function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    cache: "no-store",
  });
}

/** Текст ошибки API для alert — на Vercel иначе видно только «Не удалось сохранить». */
export async function readAdminError(
  res: Response,
  fallback = "Не удалось сохранить.",
): Promise<string> {
  if (res.status === 401) {
    return "Сессия админки не принята. Откройте https://www.illucards.by/admin/login, войдите и сохраните снова.";
  }
  try {
    const data = (await res.json()) as { error?: string };
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error.trim();
    }
  } catch {
    /* ignore */
  }
  return `${fallback} Код ${res.status}.`;
}
