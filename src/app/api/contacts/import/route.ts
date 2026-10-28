import { NextResponse } from "next/server";
import { getDb, now } from "@/lib/db";
import { isValidEmail, normalizeEmail, deriveNameFromEmail } from "@/lib/validation";
import { v4 as uuidv4 } from "uuid";
import * as XLSX from "exceljs";

export const runtime = "nodejs";

function pick(row: any, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  // case-insensitive
  const lower = Object.keys(row).reduce((acc: any, k) => {
    acc[k.toLowerCase().trim()] = row[k];
    return acc;
  }, {});
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function rowsToContacts(rows: any[]) {
  const contacts: any[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const r of rows) {
    const email = normalizeEmail(pick(r, ["email", "e-mail", "email address", "mail"]));
    if (!email) continue;
    if (!isValidEmail(email)) {
      errors.push(`Malformed email: ${email}`);
      continue;
    }
    if (seen.has(email)) dupes.push(email);
    seen.add(email);
    const rawName = pick(r, ["name", "full name", "contact name", "person"]);
    contacts.push({
      name: rawName || deriveNameFromEmail(email),
      email,
      role: pick(r, ["role", "title", "job title", "position"]),
      org: pick(r, ["organization", "org", "company", "employer"]),
      notes: pick(r, ["notes", "note", "personal notes", "comments"]),
    });
  }
  return { contacts, errors, dupes };
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaign_id");
  if (!campaignId) return NextResponse.json({ error: "campaign_id required" }, { status: 400 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "multipart form expected" }, { status: 400 });
  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  const name = (file as any).name || "upload";
  if (!/\\.(csv|xlsx|xls)$/i.test(name)) {
    return NextResponse.json({ error: "Unsupported file type. Please upload a CSV or Excel file (.csv, .xlsx, .xls). For PDFs, use the Attach feature on the Compose page." }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  let rows: any[] = [];

  if (name.toLowerCase().endsWith(".csv")) {
    const text = buf.toString("utf8");
    // simple CSV parse via papaparse-like manual? Use dynamic import
    const Papa = (await import("papaparse")).default;
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    rows = parsed.data as any[];
  } else {
    const wb = new (XLSX as any).Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0];
    const header: string[] = [];
    ws.getRow(1).eachCell((c: any, i: number) => {
      header[i - 1] = String(c.value ?? "").trim();
    });
    ws.eachRow((row: any, idx: number) => {
      if (idx === 1) return;
      const obj: any = {};
      row.eachCell((c: any, i: number) => {
        const key = header[i - 1] || `col${i}`;
        obj[key] = c.value;
      });
      // skip completely empty
      if (Object.values(obj).every((v) => v === null || v === undefined || String(v).trim() === "")) return;
      rows.push(obj);
    });
  }

  const { contacts: rawContacts, errors, dupes: rawDupes } = rowsToContacts(rows);

  const db = getDb();
  const existing = new Set(
    (db.prepare("SELECT email FROM contacts WHERE campaign_id=?").all(campaignId) as any[]).map((r) => r.email)
  );
  const seen = new Set<string>();
  const contacts: any[] = [];
  const dupes: string[] = [...rawDupes];
  for (const c of rawContacts) {
    if (seen.has(c.email) || existing.has(c.email)) {
      dupes.push(c.email);
      continue;
    }
    seen.add(c.email);
    existing.add(c.email);
    contacts.push(c);
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

  return NextResponse.json({
    imported: contacts.length,
    errors,
    duplicates: dupes,
    totalRows: rows.length,
  });
}
