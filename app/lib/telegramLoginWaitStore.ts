import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { isValidLoginWaitId } from "@/app/lib/telegramLoginWaitKeys";

const STORE_FILE = path.join(process.cwd(), "data", "telegram-login-waits.json");
const REDIS_KEY = (id: string) => `illucards:lgwait:${id}`;
const PENDING_TTL_SEC = 10 * 60;
const READY_TTL_SEC = 6 * 60;

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

type FileRow = { status: "pending" | "ready"; expires: number };

async function readFileStore(): Promise<Record<string, FileRow>> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf-8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object" || Array.isArray(j)) return {};
    return j as Record<string, FileRow>;
  } catch {
    return {};
  }
}

async function writeFileStore(data: Record<string, FileRow>): Promise<void> {
  await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function pruneFileStore(data: Record<string, FileRow>): Record<string, FileRow> {
  const now = Date.now();
  const out: Record<string, FileRow> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v.expires === "number" && v.expires > now) out[k] = v;
  }
  return out;
}

export function createLoginWaitId(): string {
  return randomBytes(16).toString("hex");
}

export async function registerLoginWait(waitId: string): Promise<boolean> {
  if (!isValidLoginWaitId(waitId)) return false;
  const cred = redisRestCredentials();
  if (cred) {
    await redisSetEx(REDIS_KEY(waitId), PENDING_TTL_SEC, "pending");
    return true;
  }
  const data = pruneFileStore(await readFileStore());
  data[waitId.toLowerCase()] = {
    status: "pending",
    expires: Date.now() + PENDING_TTL_SEC * 1000,
  };
  await writeFileStore(data);
  return true;
}

export async function markLoginWaitReady(waitId: string): Promise<void> {
  if (!isValidLoginWaitId(waitId)) return;
  const id = waitId.toLowerCase();
  const cred = redisRestCredentials();
  if (cred) {
    await redisSetEx(REDIS_KEY(id), READY_TTL_SEC, "ready");
    return;
  }
  const data = pruneFileStore(await readFileStore());
  data[id] = { status: "ready", expires: Date.now() + READY_TTL_SEC * 1000 };
  await writeFileStore(data);
}

export async function isLoginWaitReady(waitId: string): Promise<boolean> {
  if (!isValidLoginWaitId(waitId)) return false;
  const id = waitId.toLowerCase();
  const cred = redisRestCredentials();
  if (cred) {
    const v = await redisGet(REDIS_KEY(id));
    return v === "ready";
  }
  const data = pruneFileStore(await readFileStore());
  const row = data[id];
  return row?.status === "ready";
}
