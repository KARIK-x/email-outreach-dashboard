import { NextResponse } from "next/server";
import { isGmailConfigured, loadToken, getConnectedEmail } from "@/lib/gmail";

export async function GET() {
  const configured = isGmailConfigured();
  const token = loadToken();
  let email: string | null = null;
  if (configured && token) {
    email = await getConnectedEmail();
  }
  return NextResponse.json({
    configured,
    connected: Boolean(token && email),
    email,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_BASE_URL || "http://localhost:3000"}/api/gmail/callback`,
  });
}
