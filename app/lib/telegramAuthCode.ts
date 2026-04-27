/**
 * Вход по одноразовому коду из Telegram.
 * Задаётся через TELEGRAM_AUTH_CODE_MAP (JSON: код → telegram user id)
 * или TELEGRAM_AUTH_CODE_VERIFY_URL (POST { code } → { user_id }).
 */

export async function resolveTelegramAuthCodeToUserId(
  rawCode: string,
  botToken: string | undefined
): Promise<number | null> {
  const code = rawCode.trim();
  if (!code) return null;

  const mapJson = process.env.TELEGRAM_AUTH_CODE_MAP?.trim();
  if (mapJson) {
    try {
      const map = JSON.parse(mapJson) as Record<string, unknown>;
      const raw = map[code];
      const uid =
        typeof raw === "number"
          ? raw
          : typeof raw === "string"
            ? Number(raw)
            : NaN;
      if (Number.isFinite(uid) && uid > 0) {
        return Math.floor(uid);
      }
    } catch {
      /* ignore */
    }
  }

  const verifyUrl = process.env.TELEGRAM_AUTH_CODE_VERIFY_URL?.trim();
  if (verifyUrl) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (botToken) {
        headers.Authorization = `Bearer ${botToken}`;
      }
      const res = await fetch(verifyUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ code }),
        cache: "no-store",
      });
      if (!res.ok) return null;
      const j = (await res.json()) as unknown;
      if (!j || typeof j !== "object") return null;
      const o = j as Record<string, unknown>;
      const userIdRaw = o.user_id;
      const uid =
        typeof userIdRaw === "number"
          ? userIdRaw
          : typeof userIdRaw === "string"
            ? Number(userIdRaw)
            : NaN;
      if (Number.isFinite(uid) && uid > 0) {
        return Math.floor(uid);
      }
    } catch {
      return null;
    }
  }

  return null;
}

export function isTelegramCodeAuthConfigured(): boolean {
  return Boolean(
    process.env.TELEGRAM_AUTH_CODE_MAP?.trim() ||
      process.env.TELEGRAM_AUTH_CODE_VERIFY_URL?.trim()
  );
}
