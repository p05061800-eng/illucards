import { NextRequest, NextResponse } from "next/server";
import { adminSessionCookieOptions } from "@/app/lib/adminSession";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminSessionCookieOptions(request, "", 0));
  return res;
}
