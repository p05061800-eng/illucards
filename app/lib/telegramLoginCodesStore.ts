import { randomInt } from "crypto";
import { promises as fs } from "fs";
import path from "path";

const CODES_FILE = path.join(
  process.cwd(),
  "data",
  "telegram-login-codes.json",
);

const TTL_MS = 5 * 60 * 1000;

export type LoginCodeEntry = {
  user_id: number;
  username_norm: string;
  username_display: string;
  expires: number;
};

export type LoginCodesFile = Record<string, LoginCodeEntry>;

async function readFile(): Promise<LoginCodesFile> {
  try {
    const raw = await fs.readFile(CODES_FILE, "utf-8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object" || Array.isArray(j)) return {};
    return j as LoginCodesFile;
  } catch {
    return {};
  }
}

function pruneExpired(data: LoginCodesFile): LoginCodesFile {
  const now = Date.now();
  const out: LoginCodesFile = {};
  for (const [code, row] of Object.entries(data)) {
    if (!row || typeof row.expires !== "number") continue;
    if (row.expires > now) out[code] = row;
  }
  return out;
}

function stripUserCodes(data: LoginCodesFile, userId: number): LoginCodesFile {
  const out: LoginCodesFile = {};
  for (const [code, row] of Object.entries(data)) {
    if (row.user_id !== userId) out[code] = row;
  }
  return out;
}

async function writeFile(data: LoginCodesFile): Promise<void> {
  await fs.mkdir(path.dirname(CODES_FILE), { recursive: true });
  await fs.writeFile(CODES_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/** Выдать новый одноразовый код (старые коды этого user_id удаляются). */
export async function issueLoginCode(
  userId: number,
  usernameNorm: string,
  usernameDisplay: string,
): Promise<string> {
  let data = pruneExpired(await readFile());
  data = stripUserCodes(data, userId);
  const expires = Date.now() + TTL_MS;

  for (let attempt = 0; attempt < 50; attempt++) {
    const code = String(randomInt(0, 10_000)).padStart(4, "0");
    if (data[code]) continue;
    data[code] = {
      user_id: userId,
      username_norm: usernameNorm,
      username_display: usernameDisplay,
      expires,
    };
    await writeFile(data);
    return code;
  }
  throw new Error("Не удалось сгенерировать код");
}

/** Проверить код; при успехе удалить запись и вернуть данные. */
export async function consumeLoginCode(
  usernameNorm: string,
  codeRaw: string,
): Promise<{ user_id: number; username: string } | null> {
  const digits = codeRaw.replace(/\D/g, "");
  if (digits.length !== 4) return null;
  const code = digits;

  const data = pruneExpired(await readFile());
  const row = data[code];
  if (!row) return null;
  if (Date.now() > row.expires) {
    delete data[code];
    await writeFile(data);
    return null;
  }
  if (row.username_norm !== usernameNorm) {
    return null;
  }

  delete data[code];
  await writeFile(data);
  return {
    user_id: row.user_id,
    username: row.username_display,
  };
}

/** Проверить код без username; при успехе удалить запись и вернуть данные. */
export async function consumeLoginCodeByCode(
  codeRaw: string,
): Promise<{ user_id: number; username: string } | null> {
  const digits = codeRaw.replace(/\D/g, "");
  if (digits.length !== 4) return null;
  const code = digits;

  const data = pruneExpired(await readFile());
  const row = data[code];
  if (!row) return null;
  if (Date.now() > row.expires) {
    delete data[code];
    await writeFile(data);
    return null;
  }

  delete data[code];
  await writeFile(data);
  return {
    user_id: row.user_id,
    username: row.username_display,
  };
}
