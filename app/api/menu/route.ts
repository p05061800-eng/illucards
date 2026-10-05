import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/app/lib/adminSession";
import { promises as fs } from "fs";
import path from "path";
import { parseMenuJson } from "@/app/lib/menuJson";
import {
  DURABLE_JSON_KEYS,
  loadDurableJsonText,
  saveDurableJsonText,
} from "@/app/lib/durableJson";

const filePath = path.join(process.cwd(), "data", "menu.json");

const defaultMenu = JSON.stringify(
  [{ title: "Карточки", items: [] }],
  null,
  2
);

async function ensureMenuFile() {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, defaultMenu, "utf-8");
  }
}

export async function GET() {
  const data = (await loadDurableJsonText(DURABLE_JSON_KEYS.menu, filePath)) ?? defaultMenu;
  return NextResponse.json(parseMenuJson(JSON.parse(data)));
}

export async function POST(req: NextRequest) {
  const denied = rejectUnlessAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const parsed = parseMenuJson(body);
  try {
    await saveDurableJsonText(
      DURABLE_JSON_KEYS.menu,
      filePath,
      JSON.stringify(parsed, null, 2),
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Не удалось сохранить." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
