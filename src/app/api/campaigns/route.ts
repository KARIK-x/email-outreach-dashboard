import { NextResponse } from "next/server";
import { getDb, now } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM campaigns ORDER BY created_at DESC").all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim() || "Untitled campaign";
  const purpose = String(body.purpose || "").trim();
  const general_email = String(body.general_email || "").trim();
  const db = getDb();
  const id = uuidv4();
  const t = now();
  db.prepare(
    "INSERT INTO campaigns (id, name, purpose, general_email, created_at, updated_at) VALUES (?,?,?,?,?,?)"
  ).run(id, name, purpose, general_email, t, t);
  const row = db.prepare("SELECT * FROM campaigns WHERE id=?").get(id);
  return NextResponse.json(row, { status: 201 });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const db = getDb();
  const existing = db.prepare("SELECT * FROM campaigns WHERE id=?").get(id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  const name = body.name !== undefined ? String(body.name).trim() : (existing as any).name;
  const purpose = body.purpose !== undefined ? String(body.purpose) : (existing as any).purpose;
  const general_email = body.general_email !== undefined ? String(body.general_email) : (existing as any).general_email;
  db.prepare("UPDATE campaigns SET name=?, purpose=?, general_email=?, updated_at=? WHERE id=?").run(
    name,
    purpose,
    general_email,
    now(),
    id
  );
  const row = db.prepare("SELECT * FROM campaigns WHERE id=?").get(id);
  return NextResponse.json(row);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const db = getDb();
  db.prepare("DELETE FROM campaigns WHERE id=?").run(id);
  return NextResponse.json({ ok: true });
}
