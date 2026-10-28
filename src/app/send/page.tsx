"use client";
import { useEffect, useState } from "react";

export default function SendPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [gmail, setGmail] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    fetch("/api/campaigns").then((r) => r.json()).then((d) => {
      setCampaigns(d);
      if (d.length) setCampaignId(d[0].id);
    });
    fetch("/api/gmail/status").then((r) => r.json()).then(setGmail);
  }, []);

  useEffect(() => {
    if (!campaignId) { setContacts([]); return; }
    fetch(`/api/contacts?campaign_id=${campaignId}`).then((r) => r.json()).then(setContacts);
  }, [campaignId]);

  const approved = contacts.filter((c) => c.approved && !c.excluded);

  async function doSend() {
    setSending(true);
    setProgress([]);
    setSummary(null);
    setConfirm(false);
    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign_id: campaignId }),
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      setSummary({ error: data.error || "Send failed" });
      setSending(false);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        try {
          const obj = JSON.parse(line.slice(5).trim());
          if (obj.type === "progress") setProgress((p) => [...p, obj]);
          else if (obj.type === "done") setSummary(obj);
          else if (obj.type === "start") setSummary({ start: true, total: obj.total });
        } catch {}
      }
    }
    setSending(false);
    // reload contacts
    fetch(`/api/contacts?campaign_id=${campaignId}`).then((r) => r.json()).then(setContacts);
    fetch("/api/gmail/status").then((r) => r.json()).then(setGmail);
  }

  async function checkBounces() {
    const r = await fetch("/api/bounces/check", { method: "POST" });
    const data = await r.json();
    if (!r.ok) alert(data.error || "Bounce check failed");
    else alert(`Checked ${data.checked}, bounced ${data.bounced}`);
    fetch(`/api/contacts?campaign_id=${campaignId}`).then((r) => r.json()).then(setContacts);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Send</h1>

      <div className="card p-5 space-y-4">
        <div>
          <label className="label">Campaign</label>
          <select className="input" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">Select campaign</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="text-sm">
          Gmail status:{" "}
          <span className={gmail?.connected ? "text-green-600 font-medium" : "text-slate-500"}>
            {gmail?.connected ? gmail.email : gmail?.configured ? "Not connected (connect in Settings)" : "Not configured"}
          </span>
        </div>

        <div className="text-sm text-slate-600">
          Approved & not excluded: <b>{approved.length}</b> of {contacts.length}
        </div>

        {!confirm ? (
          <button
            className="btn-primary"
            disabled={sending || approved.length === 0 || !gmail?.connected}
            onClick={() => setConfirm(true)}
          >
            Send approved emails
          </button>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
            <p className="text-sm text-amber-900">
              You are about to send {approved.length} separate emails. This cannot be undone. Confirm?
            </p>
            <div className="flex gap-2">
              <button className="btn-danger" onClick={doSend} disabled={sending}>
                {sending ? "Sending..." : "Yes, send now"}
              </button>
              <button className="btn-secondary" onClick={() => setConfirm(false)} disabled={sending}>Cancel</button>
            </div>
          </div>
        )}

        <button className="btn-secondary" onClick={checkBounces}>Check bounces</button>
      </div>

      {progress.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Progress</h2>
          <div className="space-y-1 max-h-72 overflow-y-auto text-sm">
            {progress.map((p, i) => (
              <div key={i} className="flex items-center gap-2 border-b last:border-0 py-1">
                <span className="text-slate-500">{p.email}</span>
                <span
                  className={
                    p.status === "Accepted"
                      ? "text-green-600"
                      : p.status === "Failed"
                      ? "text-red-600"
                      : "text-slate-500"
                  }
                >
                  {p.status}
                </span>
                {p.error && <span className="text-xs text-red-500 truncate">{p.error}</span>}
                {p.skipped && <span className="text-xs text-slate-400">(already sent)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {summary && (
        <div className="card p-5 text-sm">
          {summary.error ? (
            <p className="text-red-600">{summary.error}</p>
          ) : (
            <p>
              Done. Sent: <b>{summary.sent ?? 0}</b>, Failed: <b>{summary.failed ?? 0}</b>
              {summary.stopped ? ` — stopped: ${summary.stopReason}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
