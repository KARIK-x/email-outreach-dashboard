import { NextResponse } from "next/server";
import { getDb, now } from "@/lib/db";
import { getAuthenticatedClient } from "@/lib/gmail";
import { google } from "googleapis";
import fs from "fs";
import { markdownToHtml } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isLimitOrAuthError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("rate limit") ||
    m.includes("quota") ||
    m.includes("user-rate") ||
    m.includes("429") ||
    m.includes("unauthorized") ||
    m.includes("invalid credentials") ||
    m.includes("auth") ||
    m.includes("permission")
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const campaignId = String(body.campaign_id || "");
  if (!campaignId) return NextResponse.json({ error: "campaign_id required" }, { status: 400 });

  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: "Gmail not connected. Connect in Settings." }, { status: 401 });
  }
  const gmail = google.gmail({ version: "v1", auth: client });

  const db = getDb();
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id=?").get(campaignId) as any;
  const contacts = db
    .prepare("SELECT * FROM contacts WHERE campaign_id=? AND excluded=0 AND approved=1 ORDER BY created_at ASC")
    .all(campaignId) as any[];
  const attachment = campaign?.attachment_name
    ? { name: campaign.attachment_name, path: campaign.attachment_path, mime: campaign.attachment_mime || "application/octet-stream" }
    : null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      let sent = 0;
      let failed = 0;
      let stopped = false;
      let stopReason = "";

      send({ type: "start", total: contacts.length });

      for (const c of contacts) {
        if (stopped) break;
        // idempotency: skip already sent
        if (c.gmail_message_id && c.status === "Accepted") {
          send({ type: "progress", id: c.id, email: c.email, status: "Accepted", skipped: true });
          continue;
        }
        // validate
        if (!c.subject || !c.body) {
          db.prepare("UPDATE contacts SET status='Failed', send_error=?, updated_at=? WHERE id=?").run(
            "Missing subject or body",
            now(),
            c.id
          );
          failed++;
          send({ type: "progress", id: c.id, email: c.email, status: "Failed", error: "Missing subject or body" });
          continue;
        }

        db.prepare("UPDATE contacts SET status='Sending', updated_at=? WHERE id=?").run(now(), c.id);
        send({ type: "progress", id: c.id, email: c.email, status: "Sending" });

        try {
          const raw = makeRawEmail(c, attachment);
          const res = await gmail.users.messages.send({
            userId: "me",
            requestBody: { raw },
          });
          const msgId = res.data.id || "";
          db.prepare(
            "UPDATE contacts SET status='Accepted', gmail_message_id=?, send_error='', sent_at=?, updated_at=? WHERE id=?"
          ).run(msgId, now(), now(), c.id);
          sent++;
          send({ type: "progress", id: c.id, email: c.email, status: "Accepted", messageId: msgId });
        } catch (e: any) {
          const msg = e?.message || String(e);
          const isLA = isLimitOrAuthError(msg);
          db.prepare("UPDATE contacts SET status='Failed', send_error=?, updated_at=? WHERE id=?").run(msg, now(), c.id);
          failed++;
          send({ type: "progress", id: c.id, email: c.email, status: "Failed", error: msg });
          if (isLA) {
            stopped = true;
            stopReason = msg;
          }
        }

        // small delay to respect limits
        await new Promise((r) => setTimeout(r, 250));
      }

      send({ type: "done", sent, failed, stopped, stopReason, total: contacts.length });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function encodeSubject(subject: string): string {
  // RFC 2047 encode if non-ASCII
  if (/[^\x20-\x7E]/.test(subject)) {
    return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
  }
  return subject;
}

function wrapBase64(b64: string): string {
  const chunks: string[] = [];
  for (let i = 0; i < b64.length; i += 76) chunks.push(b64.slice(i, i + 76));
  return chunks.join("\r\n");
}

function makeRawEmail(c: any, attachment: { name: string; path: string; mime: string } | null): string {
  const to = c.email;
  const subject = c.subject;
  const body = c.body;
  const name = c.name;
  const htmlBody = `<!DOCTYPE html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1f2937;">${markdownToHtml(body)}</body></html>`;

  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  if (!attachment) {
    const headers = [
      `To: ${name ? `"${name}" <${to}>` : to}`,
      `Subject: ${encodeSubject(subject)}`,
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: 7bit",
    ].join("\r\n");
    const raw = `${headers}\r\n\r\n${htmlBody}`;
    return Buffer.from(raw, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // multipart/mixed with attachment
  let fileBuf: Buffer;
  try {
    fileBuf = fs.readFileSync(attachment.path);
  } catch {
    // fall back to no attachment if file missing
    fileBuf = Buffer.alloc(0);
  }
  const fileB64 = wrapBase64(fileBuf.toString("base64"));

  const parts: string[] = [];
  parts.push(`--${boundary}`);
  parts.push('Content-Type: text/html; charset="UTF-8"');
  parts.push("Content-Transfer-Encoding: 7bit");
  parts.push("");
  parts.push(htmlBody);
  parts.push("");
  if (fileBuf.length > 0) {
    parts.push(`--${boundary}`);
    parts.push(`Content-Type: ${attachment.mime}; name="${attachment.name}"`);
    parts.push(`Content-Disposition: attachment; filename="${attachment.name}"`);
    parts.push("Content-Transfer-Encoding: base64");
    parts.push("");
    parts.push(fileB64);
    parts.push("");
  }
  parts.push(`--${boundary}--`);

  const headers = [
    `To: ${name ? `"${name}" <${to}>` : to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].join("\r\n");
  const raw = `${headers}\r\n\r\n${parts.join("\r\n")}`;
  return Buffer.from(raw, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
