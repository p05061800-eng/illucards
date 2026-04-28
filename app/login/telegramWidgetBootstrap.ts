import type { TelegramVerifiedProfile } from "@/app/lib/telegramAuth";

type BootstrapResult =
  | { ok: true; profile: TelegramVerifiedProfile }
  | { ok: false };

let inflight: Promise<BootstrapResult> | null = null;

/** Один запрос на cookie за короткое окно (React Strict Mode / двойной mount). */
export function fetchTelegramWidgetBootstrapOnce(): Promise<BootstrapResult> {
  if (!inflight) {
    inflight = (async (): Promise<BootstrapResult> => {
      try {
        const res = await fetch("/api/auth/telegram/bootstrap", {
          credentials: "include",
        });
        const data = (await res.json()) as {
          ok?: boolean;
          profile?: TelegramVerifiedProfile;
        };
        if (!res.ok || !data.ok || !data.profile) {
          return { ok: false };
        }
        return { ok: true, profile: data.profile };
      } catch {
        return { ok: false };
      }
    })();

    void inflight.finally(() => {
      window.setTimeout(() => {
        inflight = null;
      }, 3000);
    });
  }
  return inflight;
}
