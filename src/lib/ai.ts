import OpenAI from "openai";

export function isAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export type RecipientInfo = {
  name: string;
  email: string;
  role: string;
  org: string;
  notes: string;
};

export type GenerationInput = {
  purpose: string;
  generalEmail: string;
  recipient: RecipientInfo;
};

export type GeneratedEmail = { subject: string; body: string };

const SYSTEM = `You write personalized outreach emails. Rules:
- Use only facts provided about the recipient. Never invent personal details, history, or relationships.
- Keep it natural, professional, concise (under 180 words in body).
- No spammy language, no fake urgency, no misleading subject lines.
- Subject line specific and honest.
- Sign off generically (no fabricated name). Use a placeholder like "[Your name]" for sender signature.
- Return JSON only: {"subject":"...","body":"..."}.`;

export async function generateEmail(input: GenerationInput): Promise<GeneratedEmail> {
  if (!isAIConfigured()) {
    throw new Error("AI not configured");
  }
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const user = `Purpose of outreach: ${input.purpose}

General email template to adapt: ${input.generalEmail}

Recipient:
- Name: ${input.recipient.name || "(unknown)"}
- Email: ${input.recipient.email}
- Role: ${input.recipient.role || "(unknown)"}
- Organization: ${input.recipient.org || "(unknown)"}
- Personal notes: ${input.recipient.notes || "(none)"}

Write a personalized subject and body. JSON only.`;

  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.6,
  });
  const text = resp.choices[0]?.message?.content || "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI returned invalid JSON");
  }
  const subject = String(parsed.subject || "").trim();
  const body = String(parsed.body || "").trim();
  if (!subject || !body) throw new Error("AI returned empty content");
  return { subject, body };
}

// Non-AI deterministic template fallback, clearly labeled.
export function templateEmail(input: GenerationInput): GeneratedEmail {
  const r = input.recipient;
  const name = r.name || "there";
  const org = r.org ? ` at ${r.org}` : "";
  const role = r.role ? ` as ${r.role}` : "";
  const subject = `${input.purpose} — quick note for ${r.name || r.email}`;
  const body = `Hi ${name},

I hope you're doing well. I'm reaching out regarding ${input.purpose}${org ? ` (I saw you work${role}${org})` : ""}.

${input.generalEmail}

${r.notes ? `I also noted: ${r.notes}\n\n` : ""}Would you be open to a brief conversation? Happy to share more context.

Best,
[Your name]`;
  return { subject, body };
}

// Simple personalization: substitute placeholders in the base email with recipient info.
// Supports [name], [first name], [Name], {{name}}, {name}, [email], [role], [organization]/[org]/[company].
export function simpleEmail(input: GenerationInput): GeneratedEmail {
  const r = input.recipient;
  const nameParts = (r.name || "").trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
  const fullName = r.name || "";
  const today = new Date().toLocaleDateString();
  const replacements: Record<string, string> = {
    name: firstName || fullName,
    "first name": firstName,
    "first_name": firstName,
    firstname: firstName,
    "last name": lastName,
    "last_name": lastName,
    lastname: lastName,
    surname: lastName,
    "full name": fullName,
    fullname: fullName,
    email: r.email || "",
    role: r.role || "",
    title: r.role || "",
    position: r.role || "",
    organization: r.org || "",
    org: r.org || "",
    company: r.org || "",
    employer: r.org || "",
    notes: r.notes || "",
    note: r.notes || "",
    date: today,
    today: today,
  };

  function replace(text: string): string {
    let out = text;
    // parenthesis placeholders: (name), (Name)
    out = out.replace(/\(([^)]+)\)/g, (m, key) => {
      const k = String(key).trim().toLowerCase();
      if (Object.prototype.hasOwnProperty.call(replacements, k)) return replacements[k] || m;
      return m;
    });
    // bracket placeholders: [name], [first name]
    out = out.replace(/\[([^\]]+)\]/g, (m, key) => {
      const k = String(key).trim().toLowerCase();
      if (Object.prototype.hasOwnProperty.call(replacements, k)) return replacements[k] || m;
      return m;
    });
    // double-brace: {{name}}
    out = out.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, key) => {
      const k = String(key).trim().toLowerCase();
      if (Object.prototype.hasOwnProperty.call(replacements, k)) return replacements[k] || m;
      return m;
    });
    // single-brace: {name}
    out = out.replace(/\{\s*([a-zA-Z_ ]+?)\s*\}/g, (m, key) => {
      const k = String(key).trim().toLowerCase();
      if (Object.prototype.hasOwnProperty.call(replacements, k)) return replacements[k] || m;
      return m;
    });
    return out;
  }

  const base = input.generalEmail || "";
  // Subject: if base contains placeholders use base-ish subject; otherwise purpose + name
  let subject = input.purpose || "Hello";
  subject = replace(subject);
  if (subject === (input.purpose || "Hello") && r.name) {
    // no placeholder in purpose; append name only if purpose lacks it
    if (!subject.toLowerCase().includes(r.name.toLowerCase())) {
      subject = `${subject} — ${r.name}`;
    }
  }
  const body = replace(base);
  return { subject, body };
}
