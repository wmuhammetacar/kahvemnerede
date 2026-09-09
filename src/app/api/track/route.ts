import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Branch required. Use /api/b/[slug]/track." },
    { status: 410 }
  );
}
