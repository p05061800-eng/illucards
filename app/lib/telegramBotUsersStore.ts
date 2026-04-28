import { promises as fs } from "fs";
import path from "path";

const USERS_FILE = path.join(
  process.cwd(),
  "data",
  "telegram-bot-users.json",
);

export type TelegramBotUserRow = {
  user_id: number;
  /** Как в Telegram, без @ */
  username: string;
};

export type TelegramBotUsersFile = Record<string, TelegramBotUserRow>;

/** Ключ: username в нижнем регистре без @ */
export function normalizeTelegramUsername(input: string): string {
  let s = input.trim();
  if (s.startsWith("@")) s = s.slice(1);
  s = s.toLowerCase();
  if (!/^[a-z0-9_]{5,32}$/.test(s)) return "";
  return s;
}

export async function loadTelegramBotUsers(): Promise<TelegramBotUsersFile> {
  try {
    const raw = await fs.readFile(USERS_FILE, "utf-8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object" || Array.isArray(j)) return {};
    const out: TelegramBotUsersFile = {};
    for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
      if (typeof v !== "object" || v === null) continue;
      const o = v as Record<string, unknown>;
      const uid =
        typeof o.user_id === "number"
          ? o.user_id
          : typeof o.user_id === "string"
            ? Number(o.user_id)
            : NaN;
      const un =
        typeof o.username === "string" ? o.username.trim().replace(/^@/, "") : "";
      if (!Number.isFinite(uid) || uid <= 0 || !un) continue;
      const key = k.toLowerCase().replace(/^@/, "");
      out[key] = { user_id: Math.floor(uid), username: un };
    }
    return out;
  } catch {
    return {};
  }
}

export async function findBotUserByUsername(
  normalized: string,
): Promise<TelegramBotUserRow | null> {
  if (!normalized) return null;
  const all = await loadTelegramBotUsers();
  return all[normalized] ?? null;
}
