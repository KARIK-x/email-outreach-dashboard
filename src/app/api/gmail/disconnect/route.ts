import { NextResponse } from "next/server";
import { clearToken } from "@/lib/gmail";

export async function POST() {
  clearToken();
  return NextResponse.json({ ok: true });
}
