import { NextResponse } from "next/server";
import { getDb, now } from "@/lib/db";
import { findEmail, isFinderConfigured } from "@/lib/emailFinder";

export async function GET() {
  return NextResponse.json({ configured: isFinderConfigured() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const db = getDb();
  const contact = db.prepare("SELECT * FROM contacts WHERE id=?").get(id) as any;
  if (!contact) return NextResponse.json({ error: "not found" }, { status: 404 });

  const linkedin = String(body.linkedin ?? contact.linkedin ?? "").trim();
  const name = String(body.name ?? contact.name ?? "").trim();
  const org = String(body.org ?? contact.org ?? "").trim();
  const domain = String(body.domain ?? "").trim();

  const res = await findEmail({ linkedinUrl: linkedin, name, org, domain });

  if (linkedin) {
    db.prepare("UPDATE contacts SET linkedin=?, updated_at=? WHERE id=?").run(linkedin, now(), id);
  }

  if (res.email) {
    db.prepare(
      "UPDATE contacts SET email=?, email_verified=?, email_confidence=?, email_source=?, updated_at=? WHERE id=?"
    ).run(res.email, res.verified ? 1 : 0, res.confidence, res.source, now(), id);
  }

  const updated = db.prepare("SELECT * FROM contacts WHERE id=?").get(id);
  return NextResponse.json({ result: res, contact: updated });
}
