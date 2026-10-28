import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const totalContacts = (db.prepare("SELECT COUNT(*) as n FROM contacts").get() as any).n;
  const draftsReady = (db.prepare("SELECT COUNT(*) as n FROM contacts WHERE subject<>'' AND body<>'' AND excluded=0").get() as any).n;
  const approved = (db.prepare("SELECT COUNT(*) as n FROM contacts WHERE approved=1 AND excluded=0").get() as any).n;
  const sent = (db.prepare("SELECT COUNT(*) as n FROM contacts WHERE status='Accepted'").get() as any).n;
  const failed = (db.prepare("SELECT COUNT(*) as n FROM contacts WHERE status='Failed'").get() as any).n;
  const bounced = (db.prepare("SELECT COUNT(*) as n FROM contacts WHERE status='Bounced'").get() as any).n;
  const campaigns = (db.prepare("SELECT COUNT(*) as n FROM campaigns").get() as any).n;
  return NextResponse.json({ totalContacts, draftsReady, approved, sent, failed, bounced, campaigns });
}
