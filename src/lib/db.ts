import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "outreach.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  return _db;
}

function addColumnIfMissing(db: Database.Database, table: string, col: string, def: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  if (!cols.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  }
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT '',
      general_email TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      org TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Draft',
      subject TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      approved INTEGER NOT NULL DEFAULT 0,
      excluded INTEGER NOT NULL DEFAULT 0,
      send_error TEXT NOT NULL DEFAULT '',
      gmail_message_id TEXT NOT NULL DEFAULT '',
      sent_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL DEFAULT '',
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL DEFAULT '',
      expiry_date INTEGER NOT NULL DEFAULT 0,
      scope TEXT NOT NULL DEFAULT '',
      token_type TEXT NOT NULL DEFAULT 'Bearer',
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_contacts_campaign ON contacts(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
  `);
  // Backfill new columns for existing DBs
  addColumnIfMissing(db, "contacts", "linkedin", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "contacts", "email_verified", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "contacts", "email_confidence", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "contacts", "email_source", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "campaigns", "attachment_name", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "campaigns", "attachment_path", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "campaigns", "attachment_mime", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "campaigns", "attachment_size", "INTEGER NOT NULL DEFAULT 0");
}

export type Campaign = {
  id: string;
  name: string;
  purpose: string;
  general_email: string;
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  campaign_id: string;
  name: string;
  email: string;
  role: string;
  org: string;
  notes: string;
  status: string;
  subject: string;
  body: string;
  approved: number;
  excluded: number;
  send_error: string;
  gmail_message_id: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  linkedin: string;
  email_verified: number;
  email_confidence: number;
  email_source: string;
};

export type OAuthToken = {
  id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  scope: string;
  token_type: string;
  updated_at: string;
};

export function now(): string {
  return new Date().toISOString();
}
