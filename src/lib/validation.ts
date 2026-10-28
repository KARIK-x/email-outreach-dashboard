const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function detectDuplicates(emails: string[]): Set<string> {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const e of emails) {
    const n = normalizeEmail(e);
    if (seen.has(n)) dupes.add(n);
    seen.add(n);
  }
  return dupes;
}

export function deriveNameFromEmail(email: string): string {
  const local = (email || "").split("@")[0] || "";
  const parts = local.split(/[._+-]+/).filter(Boolean);
  if (parts.length === 0) return "";
  // Use only the first name part for greetings (e.g. aadarsa.karki -> Aadarsha)
  const first = parts[0];
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}
