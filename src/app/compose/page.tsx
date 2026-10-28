"use client";
import { useEffect, useState, useRef } from "react";
import { htmlToMarkdown } from "@/lib/format";

export default function ComposePage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [campaign, setCampaign] = useState<any>(null);
  const [purpose, setPurpose] = useState("");
  const [generalEmail, setGeneralEmail] = useState("");
  const [aiConfigured, setAiConfigured] = useState(false);
  const [useAI, setUseAI] = useState(true);
  const [mode, setMode] = useState("simple");
  const [attachment, setAttachment] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/campaigns").then((r) => r.json()).then((d) => {
      setCampaigns(d);
      if (d.length) setCampaignId(d[0].id);
    });
    fetch("/api/generate").then((r) => r.json()).then((d) => setAiConfigured(d.configured));
  }, []);

  useEffect(() => {
    if (!campaignId) { setAttachment(null); return; }
    fetch("/api/campaigns").then((r) => r.json()).then((d) => {
      const c = d.find((x: any) => x.id === campaignId);
      setPurpose(c?.purpose || "");
      setGeneralEmail(c?.general_email || "");
    });
    fetch(`/api/campaigns/attachment?campaign_id=${campaignId}`).then((r) => r.json()).then(setAttachment).catch(() => setAttachment(null));
  }, [campaignId]);

  async function saveCampaign() {
    if (!campaignId) return;
    await fetch("/api/campaigns", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: campaignId, purpose, general_email: generalEmail }),
    });
    setMsg("Saved campaign details.");
  }

  async function uploadAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !campaignId) return;
    const form = new FormData();
    form.append("campaign_id", campaignId);
    form.append("file", file);
    const r = await fetch("/api/campaigns/attachment", { method: "POST", body: form });
    const data = await r.json();
    if (!r.ok) setMsg(data.error || "Upload failed");
    else {
      setAttachment({ name: data.name, size: data.size, mime: data.mime, hasAttachment: true });
      setMsg(`Attached ${data.name}`);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function removeAttachment() {
    if (!campaignId) return;
    await fetch(`/api/campaigns/attachment?campaign_id=${campaignId}`, { method: "DELETE" });
    setAttachment({ name: "", size: 0, mime: "", hasAttachment: false });
    setMsg("Attachment removed.");
  }

  async function generate() {
    if (!campaignId) return;
    setLoading(true);
    setMsg("");
    await saveCampaign();
    const r = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign_id: campaignId, useAI, mode, force: true }),
    });
    const data = await r.json();
    if (!r.ok) setMsg(data.error || "Generation failed");
    else setMsg(`Generated ${data.processed} drafts.${data.aiFailed ? " (AI failed, used template fallback)" : ""}`);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Compose</h1>

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

        {!aiConfigured && (
          <div className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3">
            AI is not configured (OPENAI_API_KEY missing). Generation will use a basic template. Set the env var to enable AI personalization.
          </div>
        )}

        <div>
          <label className="label">Purpose of outreach</label>
          <input className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Introduce our new analytics tool" />
        </div>

        <div>
          <label className="label">General email you want to send</label>
          <textarea
            className="input"
            rows={6}
            value={generalEmail}
            onChange={(e) => setGeneralEmail(e.target.value)}
            onPaste={(e) => {
              const html = e.clipboardData.getData("text/html");
              if (html) {
                e.preventDefault();
                const md = htmlToMarkdown(html);
                const ta = e.target as HTMLTextAreaElement;
                const start = ta.selectionStart;
                const end = ta.selectionEnd;
                const next = generalEmail.slice(0, start) + md + generalEmail.slice(end);
                setGeneralEmail(next);
              }
            }}
            placeholder="Paste your base email here. It will be personalized per recipient."
          />
        </div>

        <div className="space-y-2">
          <label className="label">Attachment (optional, sent with every email)</label>
          {attachment?.hasAttachment ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-700">{attachment.name} ({Math.round((attachment.size || 0) / 1024)} KB)</span>
              <button className="text-xs text-red-600 hover:underline" onClick={removeAttachment}>Remove</button>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const f = e.dataTransfer.files?.[0];
                if (f) {
                  const dt = new DataTransfer();
                  dt.items.add(f);
                  if (fileRef.current) fileRef.current.files = dt.files;
                  uploadAttachment({ target: { files: dt.files } } as any);
                }
              }}
              className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center text-sm text-slate-500 hover:border-slate-500 cursor-pointer"
            >
              <input ref={fileRef} type="file" onChange={uploadAttachment} className="hidden" id="attach-input" />
              <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
                Attach file
              </button>
              <span className="text-xs text-slate-400">or drag & drop here</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="label">Personalization mode</label>
            <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="simple">Simple (replace [name] placeholders)</option>
              <option value="ai" disabled={!aiConfigured}>AI (OpenAI/Ollama)</option>
              <option value="template">Template (full base rewrite)</option>
            </select>
          </div>
          <button className="btn-secondary" onClick={saveCampaign}>Save</button>
          <button className="btn-primary" onClick={generate} disabled={loading || !campaignId}>
            {loading ? "Generating..." : "Generate drafts"}
          </button>
        </div>
        {msg && <div className="text-sm text-slate-700">{msg}</div>}
      </div>
    </div>
  );
}
