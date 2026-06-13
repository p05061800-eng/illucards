import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { isValidLoginWaitId } from "@/app/lib/telegramLoginWaitKeys";

const STORE_FILE = path.join(process.cwd(), "data", "telegram-login-waits.json");
const REDIS_KEY = (id: string) => `illucards:lgwait:${id}`;
const REDIS_DONE_KEY = (id: string) => `illucards:lgwait:done:${id}`;
const PENDING_TTL_SEC = 10 * 60;
const READY_TTL_SEC = 6 * 60;
const DONE_TTL_SEC = 3 * 60;

export type LoginWaitProfile = {
  user_id: number;
  username?: string;
};

type WaitRow = {
  status: "pending" | "ready";
  expires: number;
  user_id?: number;
  username?: string;
};

function redisRestCredentials(): { url: string; token: string } | null {
  const u =
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim();
  const t =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim();
  if (!u || !t) return null;
  return { url: u, token: t };
}

async function redisCommand(
  cmd: unknown[],
): Promise<{ result?: unknown; error?: string } | null> {
  const cred = redisRestCredentials();
  if (!cred) return null;
  try {
    const res = await fetch(cred.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${cred.token}` },
      body: JSON.stringify(cmd),
      cache: "no-store",
    });
    return (await res.json()) as { result?: unknown; error?: string };
  } catch {
    return null;
  }
}

async function redisSetEx(key: string, seconds: number, value: string): Promise<void> {
  await redisCommand(["SET", key, value, "EX", String(seconds)]);
}

async function redisGet(key: string): Promise<string | null> {
  const j = await redisCommand(["GET", key]);
  if (!j || j.error) return null;
  const r = j.result;
  if (typeof r !== "string") return null;
  return r;
}

async function redisDel(key: string): Promise<void> {
  await redisCommand(["DEL", key]);
}

function profileFromWaitRow(row: WaitRow): LoginWaitProfile | null {
  if (!row.user_id || row.user_id <= 0) return null;
  return {
    user_id: row.user_id,
    username: row.username,
  };
}

function parseDoneProfile(raw: string | null): LoginWaitProfile | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object" || Array.isArray(j)) return null;
    const o = j as Record<string, unknown>;
    const uid =
      typeof o.user_id === "number" && Number.isFinite(o.user_id) && o.user_id > 0
        ? Math.floor(o.user_id)
        : null;
    if (uid == null) return null;
    const username =
      typeof o.username === "string" && o.username.trim()
        ? o.username.trim().replace(/^@/, "")
        : undefined;
    return { user_id: uid, username };
  } catch {
    return null;
  }
}

function serializeDoneProfile(profile: LoginWaitProfile): string {
  return JSON.stringify({
    user_id: profile.user_id,
    username: profile.username ?? "",
  });
}

async function readDoneProfile(waitId: string): Promise<LoginWaitProfile | null> {
  const id = waitId.toLowerCase();
  const cred = redisRestCredentials();
  if (cred) {
    return parseDoneProfile(await redisGet(REDIS_DONE_KEY(id)));
  }
  const data = pruneFileStore(await readFileStore());
  const row = data[`done:${id}`];
  if (!row || row.status !== "ready" || (row.expires ?? 0) <= Date.now()) return null;
  return profileFromWaitRow(row);
}

async function writeDoneProfile(waitId: string, profile: LoginWaitProfile): Promise<void> {
  const id = waitId.toLowerCase();
  const cred = redisRestCredentials();
  if (cred) {
    await redisSetEx(REDIS_DONE_KEY(id), DONE_TTL_SEC, serializeDoneProfile(profile));
    return;
  }
  const data = pruneFileStore(await readFileStore());
  data[`done:${id}`] = {
    status: "ready",
    expires: Date.now() + DONE_TTL_SEC * 1000,
    user_id: profile.user_id,
    username: profile.username,
  };
  await writeFileStore(data);
}

function serializeWaitRow(row: WaitRow): string {
  return JSON.stringify(row);
}

function parseWaitRow(raw: string | null): WaitRow | null {
  if (!raw) return null;
  if (raw === "pending") {
    return { status: "pending", expires: Date.now() + PENDING_TTL_SEC * 1000 };
  }
  if (raw === "ready") {
    return { status: "ready", expires: Date.now() + READY_TTL_SEC * 1000 };
  }
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object" || Array.isArray(j)) return null;
    const o = j as Record<string, unknown>;
    const status = o.status === "ready" ? "ready" : o.status === "pending" ? "pending" : null;
    if (!status) return null;
    const expires =
      typeof o.expires === "number" && Number.isFinite(o.expires)
        ? o.expires
        : Date.now() + READY_TTL_SEC * 1000;
    const uid =
      typeof o.user_id === "number" && Number.isFinite(o.user_id) && o.user_id > 0
        ? Math.floor(o.user_id)
        : undefined;
    const username =
      typeof o.username === "string" && o.username.trim()
        ? o.username.trim().replace(/^@/, "")
        : undefined;
    return { status, expires, user_id: uid, username };
  } catch {
    return null;
  }
}

async function readFileStore(): Promise<Record<string, WaitRow>> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf-8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object" || Array.isArray(j)) return {};
    return j as Record<string, WaitRow>;
  } catch {
    return {};
  }
}

async function writeFileStore(data: Record<string, WaitRow>): Promise<void> {
  await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function pruneFileStore(data: Record<string, WaitRow>): Record<string, WaitRow> {
  const now = Date.now();
  const out: Record<string, WaitRow> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v.expires === "number" && v.expires > now) out[k] = v;
  }
  return out;
}

async function readWaitRow(waitId: string): Promise<WaitRow | null> {
  const id = waitId.toLowerCase();
  const cred = redisRestCredentials();
  if (cred) {
    return parseWaitRow(await redisGet(REDIS_KEY(id)));
  }
  const data = pruneFileStore(await readFileStore());
  return data[id] ?? null;
}

async function writeWaitRow(waitId: string, row: WaitRow): Promise<void> {
  const id = waitId.toLowerCase();
  const cred = redisRestCredentials();
  if (cred) {
    const ttlSec =
      row.status === "ready"
        ? READY_TTL_SEC
        : Math.max(1, Math.ceil((row.expires - Date.now()) / 1000));
    await redisSetEx(REDIS_KEY(id), ttlSec, serializeWaitRow(row));
    return;
  }
  const data = pruneFileStore(await readFileStore());
  data[id] = row;
  await writeFileStore(data);
}

async function deleteWaitRow(waitId: string): Promise<void> {
  const id = waitId.toLowerCase();
  const cred = redisRestCredentials();
  if (cred) {
    await redisDel(REDIS_KEY(id));
    return;
  }
  const data = pruneFileStore(await readFileStore());
  delete data[id];
  await writeFileStore(data);
}

export function createLoginWaitId(): string {
  return randomBytes(16).toString("hex");
}

export async function registerLoginWait(waitId: string): Promise<boolean> {
  if (!isValidLoginWaitId(waitId)) return false;
  await writeWaitRow(waitId, {
    status: "pending",
    expires: Date.now() + PENDING_TTL_SEC * 1000,
  });
  return true;
}

export async function markLoginWaitReady(
  waitId: string,
  profile?: LoginWaitProfile,
): Promise<void> {
  if (!isValidLoginWaitId(waitId)) return;
  const row: WaitRow = {
    status: "ready",
    expires: Date.now() + READY_TTL_SEC * 1000,
  };
  if (profile && profile.user_id > 0) {
    row.user_id = Math.floor(profile.user_id);
    if (profile.username?.trim()) {
      row.username = profile.username.trim().replace(/^@/, "");
    }
  }
  await writeWaitRow(waitId, row);
}

/** Профиль из готового wait_id без списания (для poll / fallback). */
export async function peekLoginWaitProfile(
  waitId: string,
): Promise<LoginWaitProfile | null> {
  if (!isValidLoginWaitId(waitId)) return null;

  const done = await readDoneProfile(waitId);
  if (done) return done;

  const row = await readWaitRow(waitId);
  if (!row || row.status !== "ready" || (row.expires ?? 0) <= Date.now()) {
    return null;
  }
  return profileFromWaitRow(row);
}

export async function isLoginWaitReady(waitId: string): Promise<boolean> {
  const profile = await peekLoginWaitProfile(waitId);
  return profile != null;
}

/** Одноразово забрать профиль после подтверждения в боте (автовход без кода). */
export async function consumeLoginWait(
  waitId: string,
): Promise<LoginWaitProfile | null> {
  if (!isValidLoginWaitId(waitId)) return null;

  const done = await readDoneProfile(waitId);
  if (done) return done;

  const row = await readWaitRow(waitId);
  if (!row || row.status !== "ready" || (row.expires ?? 0) <= Date.now()) {
    return null;
  }
  const profile = profileFromWaitRow(row);
  if (!profile) return null;

  await deleteWaitRow(waitId);
  await writeDoneProfile(waitId, profile);
  return profile;
}
