# 📧 Email Outreach Dashboard

![Next.js](https://img.shields.io/badge/Next.js-16.4-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)
![License](https://img.shields.io/badge/License-MIT-green)

A simple, modern, full-stack email outreach dashboard. Import contacts, personalize emails with AI or simple name substitution, review/edit every draft, and send via Gmail with OAuth 2.0 — one email per recipient, with progress tracking and attachment support.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📥 **Import Contacts** | Upload CSV/Excel or paste emails. Auto-detects duplicates & malformed addresses. Auto-derives first names from emails. |
| 🤖 **AI Personalization** | Generate personalized subject + body per recipient using Ollama/OpenAI. Strict prompt: no invented details. |
| ✏️ **Simple Mode** | Just replace `(name)`, `(organization)`, etc. in your draft — keeps 98% of the email identical. |
| 👀 **Email Preview** | Table view with full-draft preview modal, inline edit, approve/exclude. |
| 📤 **Send Emails** | Gmail OAuth 2.0, one email per recipient, HTML formatting, attachments, SSE progress, stops on limits/errors. |
| 📎 **Attachments** | Drag & drop files (e.g., CV) — attached to every email in a campaign. |
| 🔍 **Email Finder** | Find verified emails from name + domain (Hunter.io) or LinkedIn (Proxycurl). |
| 📊 **Dashboard** | Total contacts, drafts ready, approved, sent, failed, bounced, campaign history. |
| 🏷️ **Status Labels** | Draft · Approved · Sending · Accepted · Bounced · Failed. Never claims "delivered" without evidence. |

---

## 🖥️ Screenshots

> Run the app and explore: Dashboard, Contacts, Compose, Review, Send, Settings.

---

## 🚀 Quick Start

```bash
git clone <your-repo-url>
cd email-outreach
npm install
cp .env.example .env.local
# fill in GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (see below)
npm run dev
```

Open http://localhost:3000

---

## 🔐 Google Cloud OAuth Setup

1. Create a project at https://console.cloud.google.com
2. Enable the **Gmail API**.
3. Configure **OAuth consent screen** (External), add scopes:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
4. Add your Gmail as a **Test user**.
5. Create **OAuth 2.0 Client ID** (Web application), redirect URI:
   ```
   http://localhost:3000/api/gmail/callback
   ```
6. Copy Client ID + Secret into `.env.local`.

---

## ⚙️ Environment Variables

See `.env.example`. Key ones:

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | ✅ | OAuth redirect (default localhost) |
| `OPENAI_API_KEY` | ❌ | AI personalization (OpenAI/Ollama) |
| `OPENAI_BASE_URL` | ❌ | e.g. `http://localhost:11434/v1` for Ollama |
| `OPENAI_MODEL` | ❌ | e.g. `llama3.2:latest` |
| `HUNTER_API_KEY` | ❌ | Verified email finder |
| `PROXYCURL_API_KEY` | ❌ | LinkedIn → email |

---

## 🤖 Free AI with Ollama (no API key)

```bash
# install ollama, then:
ollama pull llama3.2
# .env.local:
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=llama3.2:latest
```

---

## 🧱 Tech Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS 4)
- **SQLite** (better-sqlite3) — server-side persistence
- **Gmail API** (googleapis) — OAuth + send
- **OpenAI-compatible API** — AI personalization (Ollama/OpenAI)
- **Hunter.io / Proxycurl** — email finder (optional)

---

## 📁 Project Structure

```
src/
  app/
    page.tsx              # Dashboard
    contacts/page.tsx     # Import + manage contacts
    compose/page.tsx      # Purpose, base email, attachments
    review/page.tsx       # Preview/edit/approve/exclude
    send/page.tsx         # Final review + send + progress
    settings/page.tsx     # Gmail OAuth status
    api/                  # Server routes (gmail, contacts, generate, send, bounces, stats)
  lib/
    db.ts                 # SQLite schema + migrations
    gmail.ts              # OAuth + Gmail client
    ai.ts                 # AI + simple + template personalization
    format.ts             # Markdown ↔ HTML
    emailFinder.ts        # Hunter/Proxycurl
    validation.ts         # Email validation + name derivation
```

---

## 🛡️ Security

- OAuth tokens stored server-side in SQLite, never exposed to the frontend.
- Secrets in `.env.local` (gitignored).
- No spam-filter evasion. Focus on legitimate outreach, valid recipients, correct auth.

---

## 📝 Notes

- Emails are labeled **Accepted** only after Gmail accepts them. "Delivered/inboxed" is never claimed.
- Bounce detection is best-effort via inbox search.
- Duplicate contacts are auto-skipped on import.

---

## 📄 License

MIT
