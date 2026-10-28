import { NextResponse } from "next/server";
import { getDb, now } from "@/lib/db";
import { isAIConfigured, generateEmail, templateEmail, simpleEmail, type RecipientInfo } from "@/lib/ai";

export async function GET() {
  return NextResponse.json({ configured: isAIConfigured() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const campaignId = String(body.campaign_id || "");
  if (!campaignId) return NextResponse.json({ error: "campaign_id required" }, { status: 400 });
  const useAI = body.useAI !== false;
  const force = Boolean(body.force);
  const mode = String(body.mode || (useAI && isAIConfigured() ? "ai" : "simple"));
  const db = getDb();
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id=?").get(campaignId) as any;
  if (!campaign) return NextResponse.json({ error: "campaign not found" }, { status: 404 });

  const contacts = db.prepare("SELECT * FROM contacts WHERE campaign_id=? AND excluded=0").all(campaignId) as any[];
  const results: any[] = [];
  let aiFailed = false;

  for (const c of contacts) {
    // skip already generated unless force
    if (!force && c.subject && c.body) {
      results.push({ id: c.id, email: c.email, skipped: true });
      continue;
    }
    const recipient: RecipientInfo = {
      name: c.name,
      email: c.email,
      role: c.role,
      org: c.org,
      notes: c.notes,
    };
    const input = { purpose: campaign.purpose, generalEmail: campaign.general_email, recipient };
    try {
      let gen;
      if (mode === "ai" && isAIConfigured()) {
        gen = await generateEmail(input);
      } else if (mode === "template") {
        gen = templateEmail(input);
      } else {
        gen = simpleEmail(input);
      }
      db.prepare("UPDATE contacts SET subject=?, body=?, status='Draft', updated_at=? WHERE id=?").run(
        gen.subject,
        gen.body,
        now(),
        c.id
      );
      results.push({ id: c.id, email: c.email, ok: true, subject: gen.subject });
    } catch (e: any) {
      aiFailed = true;
      // fallback to template on AI failure
      const gen = templateEmail(input);
      db.prepare("UPDATE contacts SET subject=?, body=?, status='Draft', updated_at=? WHERE id=?").run(
        gen.subject,
        gen.body,
        now(),
        c.id
      );
      results.push({ id: c.id, email: c.email, ok: true, fallback: true, error: e?.message });
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
    aiConfigured: isAIConfigured(),
    aiFailed,
  });
}
