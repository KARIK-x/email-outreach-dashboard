import { google } from "googleapis";
import { getDb, type OAuthToken } from "./db";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function isGmailConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getOAuth2Client() {
  if (!isGmailConfigured()) return null;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_BASE_URL || "http://localhost:3000"}/api/gmail/callback`;
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

export function getAuthUrl(): string | null {
  const client = getOAuth2Client();
  if (!client) return null;
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export function loadToken(): OAuthToken | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM oauth_tokens ORDER BY updated_at DESC LIMIT 1").get() as
    | OAuthToken
    | undefined;
  return row || null;
}

export function saveToken(token: {
  access_token: string;
  refresh_token?: string | null;
  expiry_date?: number | null;
  scope?: string | null;
  token_type?: string | null;
  email?: string | null;
}) {
  const db = getDb();
  const existing = loadToken();
  const id = existing?.id || "default";
  const refresh = token.refresh_token || existing?.refresh_token || "";
  db.prepare(
    `INSERT INTO oauth_tokens (id, email, access_token, refresh_token, expiry_date, scope, token_type, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       email=excluded.email,
       access_token=excluded.access_token,
       refresh_token=excluded.refresh_token,
       expiry_date=excluded.expiry_date,
       scope=excluded.scope,
       token_type=excluded.token_type,
       updated_at=excluded.updated_at`
  ).run(
    id,
    token.email || existing?.email || "",
    token.access_token,
    refresh,
    token.expiry_date || 0,
    token.scope || existing?.scope || "",
    token.token_type || "Bearer",
    new Date().toISOString()
  );
}

export function clearToken() {
  const db = getDb();
  db.prepare("DELETE FROM oauth_tokens").run();
}

export async function getAuthenticatedClient() {
  const client = getOAuth2Client();
  if (!client) return null;
  const tok = loadToken();
  if (!tok) return null;
  client.setCredentials({
    access_token: tok.access_token,
    refresh_token: tok.refresh_token || undefined,
    expiry_date: tok.expiry_date || undefined,
    token_type: tok.token_type || "Bearer",
    scope: tok.scope || undefined,
  });
  // refresh if needed
  client.on("tokens", (t) => {
    saveToken({
      access_token: t.access_token || tok.access_token,
      refresh_token: t.refresh_token || tok.refresh_token,
      expiry_date: t.expiry_date || tok.expiry_date,
      scope: t.scope || tok.scope,
      token_type: t.token_type || tok.token_type,
      email: tok.email,
    });
  });
  return client;
}

export async function getConnectedEmail(): Promise<string | null> {
  const tok = loadToken();
  if (tok?.email) return tok.email; // avoid extra API call
  const client = await getAuthenticatedClient();
  if (!client) return null;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const res = await oauth2.userinfo.get();
    const email = res.data.email || null;
    if (email && tok) saveToken({ ...tok, email });
    return email;
  } catch {
    return tok?.email || null;
  }
}

export { SCOPES };
