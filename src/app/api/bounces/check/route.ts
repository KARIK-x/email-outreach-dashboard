import { NextResponse } from "next/server";
import { getDb, now } from "@/lib/db";
import { getAuthenticatedClient } from "@/lib/gmail";
import { google } from "googleapis";

export async function POST() {
  const client = await getAuthenticatedClient();
  if (!client) return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });
  const gmail = google.gmail({ version: "v1", auth: client });
  const db = getDb();
  const accepted = db.prepare("SELECT * FROM contacts WHERE status='Accepted'").all() as any[];
  if (accepted.length === 0) return NextResponse.json({ checked: 0, bounced: 0 });

  let bouncedCount = 0;
  try {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: "from:mailer-daemon OR subject:\"Delivery Status Notification\" newer_than:7d",
      maxResults: 20,
    });
    const msgs = res.data.messages || [];
    // Use snippets only to avoid extra per-message API calls (quota)
    const snippets = msgs.map((m: any) => m.snippet || "").join("\n---\n").toLowerCase();
    for (const c of accepted) {
      if (snippets.includes(c.email.toLowerCase())) {
        db.prepare("UPDATE contacts SET status='Bounced', updated_at=? WHERE id=?").run(now(), c.id);
        bouncedCount++;
      }
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "bounce check failed" }, { status: 500 });
  }
  return NextResponse.json({ checked: accepted.length, bounced: bouncedCount });
}
