import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isValidLoginWaitId } from "@/app/lib/telegramLoginWaitKeys";
import {
  createLoginWaitId,
  isLoginWaitReady,
  registerLoginWait,
} from "@/app/lib/telegramLoginWaitStore";

/** Создать ожидание: после выдачи кода бот пометит ready → клиент уйдёт на /account */
export async function POST() {
  const waitId = createLoginWaitId();
  const ok = await registerLoginWait(waitId);
  if (!ok) {
    return NextResponse.json({ error: "Не удалось создать ожидание" }, { status: 500 });
  }
  return NextResponse.json({ wait_id: waitId });
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("wait_id")?.trim() ?? "";
  if (!isValidLoginWaitId(raw)) {
    return NextResponse.json({ error: "Некорректный wait_id" }, { status: 400 });
  }
  const ready = await isLoginWaitReady(raw);
  return NextResponse.json({ ready });
}
