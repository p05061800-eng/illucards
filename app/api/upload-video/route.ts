import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "videos");

const ALLOWED = new Map<string, string>([
  ["video/mp4", ".mp4"],
  ["video/webm", ".webm"],
  ["video/quicktime", ".mov"],
]);

const MAX_BYTES = 120 * 1024 * 1024;

export async function POST(req: Request) {
  const data = await req.formData();
  const file = data.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Файл слишком большой (макс. 120 МБ)." },
      { status: 400 }
    );
  }

  const ext = ALLOWED.get(file.type);
  if (!ext) {
    return NextResponse.json(
      { error: "Допустимы только MP4, WebM или MOV." },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const name = `${randomUUID()}${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), buffer);

  const url = `/uploads/videos/${name}`;
  return NextResponse.json({ url });
}
