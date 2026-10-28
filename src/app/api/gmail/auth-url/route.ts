import { NextResponse } from "next/server";
import { isGmailConfigured, getAuthUrl } from "@/lib/gmail";

export async function GET() {
  if (!isGmailConfigured()) {
    return NextResponse.json({ error: "Gmail OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." }, { status: 503 });
  }
  const url = getAuthUrl();
  if (!url) return NextResponse.json({ error: "Could not generate auth URL" }, { status: 500 });
  return NextResponse.json({ url });
}
