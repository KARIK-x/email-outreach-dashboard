import { NextResponse } from "next/server";
import { getDb, now } from "@/lib/db";
import { isValidEmail, normalizeEmail, detectDuplicates } from "@/lib/validation";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaign_id");
  const db = getDb();
  const rows = campaignId
    ? db.prepare("SELECT * FROM contacts WHERE campaign_id=? ORDER BY created_at ASC").all(campaignId)
    : db.prepare("SELECT * FROM contacts ORDER BY created_at ASC").all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const campaign_id = String(body.campaign_id || "");
  if (!campaign_id) return NextResponse.json({ error: "campaign_id required" }, { status: 400 });
  const items = Array.isArray(body.contacts) ? body.contacts : [body];
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO contacts (id, campaign_id, name, email, role, org, notes, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  );
  const t = now();
  const created: any[] = [];
  const tx = db.transaction((list: any[]) => {
    for (const c of list) {
      const email = normalizeEmail(String(c.email || ""));
      if (!email) continue;
      const id = uuidv4();
      insert.run(id, campaign_id, String(c.name || "").trim(), email, String(c.role || "").trim(), String(c.org || "").trim(), String(c.notes || "").trim(), "Draft", t, t);
      created.push({ id, campaign_id, name: c.name || "", email, role: c.role || "", org: c.org || "", notes: c.notes || "", status: "Draft" });
    }
  });
  tx(items);
  return NextResponse.json({ created: created.length, contacts: created }, { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const db = getDb();
  const existing = db.prepare("SELECT * FROM contacts WHERE id=?").get(id) as any;
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  const fields = ["name", "email", "role", "org", "notes", "status", "subject", "body", "approved", "excluded", "send_error", "gmail_message_id", "sent_at", "linkedin", "email_verified", "email_confidence", "email_source"];
  const sets: string[] = [];
  const vals: any[] = [];
  for (const f of fields) {
    if (body[f] !== undefined) {
      sets.push(`${f}=?`);
      vals.push(body[f]);
    }
  }
  if (sets.length) {
    sets.push("updated_at=?");
    vals.push(now());
    vals.push(id);
    db.prepare(`UPDATE contacts SET ${sets.join(",")} WHERE id=?`).run(...vals);
  }
  const row = db.prepare("SELECT * FROM contacts WHERE id=?").get(id);
  return NextResponse.json(row);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const campaignId = searchParams.get("campaign_id");
  const db = getDb();
  if (id) {
    db.prepare("DELETE FROM contacts WHERE id=?").run(id);
  } else if (campaignId) {
    db.prepare("DELETE FROM contacts WHERE campaign_id=?").run(campaignId);
  } else {
    return NextResponse.json({ error: "id or campaign_id required" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
