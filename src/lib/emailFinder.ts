export type FindResult = {
  email: string;
  verified: boolean;
  confidence: number;
  source: string;
  error?: string;
};

function hasProxycurl() {
  return Boolean(process.env.PROXYCURL_API_KEY);
}
function hasHunter() {
  return Boolean(process.env.HUNTER_API_KEY);
}

export function isFinderConfigured(): boolean {
  return hasProxycurl() || hasHunter();
}

// Try Proxycurl person profile (LinkedIn URL -> work/personal emails)
async function proxycurl(linkedinUrl: string): Promise<FindResult> {
  const key = process.env.PROXYCURL_API_KEY!;
  const url = `https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(linkedinUrl)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) {
    const text = await res.text();
    return { email: "", verified: false, confidence: 0, source: "proxycurl", error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  }
  const data: any = await res.json();
  const emails: string[] = [];
  if (data.work_email) emails.push(data.work_email);
  if (Array.isArray(data.personal_emails)) emails.push(...data.personal_emails);
  if (emails.length === 0) {
    return { email: "", verified: false, confidence: 0, source: "proxycurl", error: "No email found on profile" };
  }
  return { email: emails[0], verified: true, confidence: 90, source: "proxycurl" };
}

// Hunter email finder by name + domain
async function hunterFind(firstName: string, lastName: string, domain: string): Promise<FindResult> {
  const key = process.env.HUNTER_API_KEY!;
  const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${key}`;
  const res = await fetch(url);
  const data: any = await res.json();
  if (!res.ok) {
    return { email: "", verified: false, confidence: 0, source: "hunter", error: data?.errors?.[0]?.details || `HTTP ${res.status}` };
  }
  const email = data?.data?.email;
  if (!email) {
    return { email: "", verified: false, confidence: 0, source: "hunter", error: "No email found" };
  }
  const score = data?.data?.score || 0;
  const verified = Boolean(data?.data?.verification?.status === "valid" || score >= 90);
  return { email, verified, confidence: score, source: "hunter" };
}

export async function findEmail(opts: {
  linkedinUrl?: string;
  name?: string;
  org?: string;
  domain?: string;
}): Promise<FindResult> {
  // Prefer Proxycurl if LinkedIn URL provided and configured
  if (opts.linkedinUrl && hasProxycurl()) {
    return proxycurl(opts.linkedinUrl);
  }
  // Hunter by name + domain
  if (hasHunter()) {
    const name = (opts.name || "").trim();
    const parts = name.split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || "";
    let domain = (opts.domain || "").trim();
    if (!domain && opts.org) {
      // best-effort: derive domain from org (user should provide domain ideally)
      domain = opts.org.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
    }
    if (!firstName || !domain) {
      return { email: "", verified: false, confidence: 0, source: "hunter", error: "Need name and domain/org" };
    }
    return hunterFind(firstName, lastName, domain);
  }
  return { email: "", verified: false, confidence: 0, source: "none", error: "No email finder configured. Set PROXYCURL_API_KEY or HUNTER_API_KEY." };
}
