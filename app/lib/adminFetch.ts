import { apiUrl } from "@/app/lib/apiUrl";

/** Fetch из админки: всегда отправляет cookie сессии после входа. */
export function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), {
    ...init,
    credentials: "include",
  });
}
