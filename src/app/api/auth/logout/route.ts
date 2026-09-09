import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { isSameOrigin } from "@/lib/security";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  await destroySession(response, request);
  return response;
}
