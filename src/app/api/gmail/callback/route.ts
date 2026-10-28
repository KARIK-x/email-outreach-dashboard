import { NextResponse } from "next/server";
import { getOAuth2Client, saveToken, getConnectedEmail } from "@/lib/gmail";
import { google } from "googleapis";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  if (error) {
    return NextResponse.redirect(`${base}/settings?gmail=error&reason=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${base}/settings?gmail=error&reason=missing_code`);
  }
  const client = getOAuth2Client();
  if (!client) {
    return NextResponse.redirect(`${base}/settings?gmail=error&reason=not_configured`);
  }
  try {
    const { tokens } = await client.getToken(code);
    saveToken({
      access_token: tokens.access_token || "",
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      scope: tokens.scope,
      token_type: tokens.token_type,
    });
    // fetch connected email
    await getConnectedEmail();
    return NextResponse.redirect(`${base}/settings?gmail=connected`);
  } catch (e: any) {
    return NextResponse.redirect(`${base}/settings?gmail=error&reason=${encodeURIComponent(e?.message || "token_exchange_failed")}`);
  }
}
