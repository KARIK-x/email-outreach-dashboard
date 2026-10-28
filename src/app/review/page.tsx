"use client";
import { useEffect, useState } from "react";
import { markdownToHtml, htmlToMarkdown } from "@/lib/format";

export default function ReviewPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body: string }>({ subject: "", body: "" });
  const [preview, setPreview] = useState<any>(null);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    fetch("/api/campaigns").then((r) => r.json()).then((d) => {
      setCampaigns(d);
      if (d.length) setCampaignId(d[0].id);
    });
  }, []);

  useEffect(() => {
    if (!campaignId) { setContacts([]); return; }
    fetch(`/api/contacts?campaign_id=${campaignId}`).then((r) => r.json()).then(setContacts);
  }, [campaignId]);

  async function reload() {
    const r = await fetch(`/api/contacts?campaign_id=${campaignId}`);
    setContacts(await r.json());
  }

  async function saveEdit(id: string) {
    await fetch("/api/contacts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, subject: draft.subject, body: draft.body }),
    });
    setEditing(null);
    reload();
  }

  async function approve(id: string, approved: boolean) {
    await fetch("/api/contacts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, approved: approved ? 1 : 0, status: approved ? "Approved" : "Draft" }),
    });
    reload();
  }

  async function exclude(id: string, excluded: boolean) {
    await fetch("/api/contacts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, excluded: excluded ? 1 : 0 }),
    });
    reload();
  }

  async function approveAll() {
    for (const c of contacts) {
      if (c.excluded) continue;
      if (c.subject && c.body) {
        await fetch("/api/contacts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: c.id, approved: 1, status: "Approved" }),
        });
      }
    }
    reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Review</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowFull((v) => !v)}>
            {showFull ? "Collapse" : "Show full drafts"}
          </button>
          <button className="btn-secondary" onClick={approveAll}>Approve all with drafts</button>
        </div>
      </div>

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

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2">Recipient</th>
                <th className="py-2">Subject</th>
                <th className="py-2">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c: any) => (
                <tr key={c.id} className={`border-b last:border-0 ${c.excluded ? "opacity-50" : ""}`}>
                  <td className="py-2 align-top">
                    <div className="font-medium">{c.name || c.email}</div>
                    <div className="text-xs text-slate-500">{c.email}</div>
                    {c.org && <div className="text-xs text-slate-400">{c.role} {c.org}</div>}
                  </td>
                  <td className="py-2 align-top max-w-md">
                    {editing === c.id ? (
                      <div className="space-y-2">
                        <input className="input" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
                        <textarea
                          className="input"
                          rows={6}
                          value={draft.body}
                          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                          onPaste={(e) => {
                            const html = e.clipboardData.getData("text/html");
                            if (html) {
                              e.preventDefault();
                              const md = htmlToMarkdown(html);
                              const ta = e.target as HTMLTextAreaElement;
                              const start = ta.selectionStart;
                              const end = ta.selectionEnd;
                              const val = draft.body;
                              const next = val.slice(0, start) + md + val.slice(end);
                              setDraft({ ...draft, body: next });
                            }
                          }}
                        />
                        <div className="flex gap-2">
                          <button className="btn-primary" onClick={() => saveEdit(c.id)}>Save</button>
                          <button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium">{c.subject || <span className="text-slate-400">No subject</span>}</div>
                        <div className={`text-xs text-slate-600 whitespace-pre-wrap mt-1 break-words ${showFull ? "" : "line-clamp-3"}`}>{c.body}</div>
                      </div>
                    )}
                  </td>
                  <td className="py-2 align-top">
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-100">{c.status}</span>
                    {c.approved ? <span className="ml-1 text-xs text-green-600">approved</span> : null}
                  </td>
                  <td className="py-2 align-top">
                    <div className="flex flex-col gap-1">
                      <button
                        className="text-xs text-blue-600 hover:underline text-left"
                        onClick={() => setPreview(c)}
                      >
                        Preview
                      </button>
                      {editing !== c.id && (
                        <button
                          className="text-xs text-slate-700 hover:underline text-left"
                          onClick={() => { setEditing(c.id); setDraft({ subject: c.subject, body: c.body }); }}
                        >
                          Edit
                        </button>
                      )}
                      <button
                        className="text-xs text-green-700 hover:underline text-left"
                        onClick={() => approve(c.id, !c.approved)}
                      >
                        {c.approved ? "Unapprove" : "Approve"}
                      </button>
                      <button
                        className="text-xs text-red-600 hover:underline text-left"
                        onClick={() => exclude(c.id, !c.excluded)}
                      >
                        {c.excluded ? "Include" : "Exclude"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {contacts.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-slate-500">No contacts.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Email preview</h3>
              <button className="text-slate-500 hover:text-slate-900" onClick={() => setPreview(null)}>✕</button>
            </div>
            <div className="text-sm text-slate-500 mb-1">To: {preview.name || preview.email} &lt;{preview.email}&gt;</div>
            <div className="font-medium mb-3">{preview.subject}</div>
            <div className="text-sm text-slate-700 border-t pt-3 w-full break-words" dangerouslySetInnerHTML={{ __html: markdownToHtml(preview.body) }} />
          </div>
        </div>
      )}
    </div>
  );
}
