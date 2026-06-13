import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { parseMenuJson } from "@/app/lib/menuJson";

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
  await ensureMenuFile();
  const data = await fs.readFile(filePath, "utf-8");
  return NextResponse.json(parseMenuJson(JSON.parse(data)));
}

export async function POST(req: Request) {
  await ensureMenuFile();
  const body = await req.json();
  const parsed = parseMenuJson(body);
  await fs.writeFile(filePath, JSON.stringify(parsed, null, 2), "utf-8");
  return NextResponse.json({ ok: true });
}
