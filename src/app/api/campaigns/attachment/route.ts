import { NextResponse } from "next/server";
import { getDb, now } from "@/lib/db";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const ATTACH_DIR = path.join(process.cwd(), "data", "attachments");
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaign_id");
  if (!campaignId) return NextResponse.json({ error: "campaign_id required" }, { status: 400 });
  const db = getDb();
  const row = db.prepare("SELECT attachment_name, attachment_size, attachment_mime FROM campaigns WHERE id=?").get(campaignId) as any;
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    name: row.attachment_name || "",
    size: row.attachment_size || 0,
    mime: row.attachment_mime || "",
    hasAttachment: Boolean(row.attachment_name),
  });
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "multipart form expected" }, { status: 400 });
  const campaignId = String(form.get("campaign_id") || "");
  if (!campaignId) return NextResponse.json({ error: "campaign_id required" }, { status: 400 });
  const file = form.get("file");
  if (!file || !(file instanceof Blob)) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });

  const db = getDb();
  const campaign = db.prepare("SELECT id FROM campaigns WHERE id=?").get(campaignId);
  if (!campaign) return NextResponse.json({ error: "campaign not found" }, { status: 404 });

  if (!fs.existsSync(ATTACH_DIR)) fs.mkdirSync(ATTACH_DIR, { recursive: true });

  // remove previous attachment if any
  const prev = db.prepare("SELECT attachment_path FROM campaigns WHERE id=?").get(campaignId) as any;
  if (prev?.attachment_path && fs.existsSync(prev.attachment_path)) {
    try { fs.unlinkSync(prev.attachment_path); } catch {}
  }

  const originalName = (file as any).name || "attachment";
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${campaignId}_${Date.now()}_${safeName}`;
  const storedPath = path.join(ATTACH_DIR, storedName);
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(storedPath, buf);

  const mime = (file as any).type || "application/octet-stream";

  db.prepare(
    "UPDATE campaigns SET attachment_name=?, attachment_path=?, attachment_mime=?, attachment_size=?, updated_at=? WHERE id=?"
  ).run(originalName, storedPath, mime, file.size, now(), campaignId);

  return NextResponse.json({ ok: true, name: originalName, size: file.size, mime });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaign_id");
  if (!campaignId) return NextResponse.json({ error: "campaign_id required" }, { status: 400 });
  const db = getDb();
  const row = db.prepare("SELECT attachment_path FROM campaigns WHERE id=?").get(campaignId) as any;
  if (row?.attachment_path && fs.existsSync(row.attachment_path)) {
    try { fs.unlinkSync(row.attachment_path); } catch {}
  }
  db.prepare(
    "UPDATE campaigns SET attachment_name='', attachment_path='', attachment_mime='', attachment_size=0, updated_at=? WHERE id=?"
  ).run(now(), campaignId);
  return NextResponse.json({ ok: true });
}
