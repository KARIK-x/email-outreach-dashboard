import { NextResponse } from "next/server";
import { getDb, now } from "@/lib/db";
import { isValidEmail, normalizeEmail, deriveNameFromEmail } from "@/lib/validation";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const campaignId = String(body.campaign_id || "");
  if (!campaignId) return NextResponse.json({ error: "campaign_id required" }, { status: 400 });
  const text = String(body.text || "");
  const lines = text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const db = getDb();
  const contacts: any[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const dupes: string[] = [];
  // existing emails in this campaign
  const existing = new Set(
    (db.prepare("SELECT email FROM contacts WHERE campaign_id=?").all(campaignId) as any[]).map((r) => r.email)
  );
  for (const line of lines) {
    let name = "";
    let email = line;
    const m = line.match(/^(.*)<([^>]+)>$/);
    if (m) {
      name = m[1].trim();
      email = m[2].trim();
    }
    const ne = normalizeEmail(email);
    if (!isValidEmail(ne)) {
      errors.push(`Malformed: ${line}`);
      continue;
    }
    if (seen.has(ne) || existing.has(ne)) {
      dupes.push(ne);
      continue; // skip duplicate
    }
    seen.add(ne);
    existing.add(ne);
    const finalName = name || deriveNameFromEmail(ne);
    contacts.push({ name: finalName, email: ne, role: "", org: "", notes: "" });
  }

  const t = now();
  const insert = db.prepare(
    `INSERT INTO contacts (id, campaign_id, name, email, role, org, notes, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  );
  const tx = db.transaction((list: any[]) => {
    for (const c of list) {
      insert.run(uuidv4(), campaignId, c.name, c.email, c.role, c.org, c.notes, "Draft", t, t);
    }
  });
  tx(contacts);

  return NextResponse.json({ imported: contacts.length, errors, duplicates: dupes });
}
